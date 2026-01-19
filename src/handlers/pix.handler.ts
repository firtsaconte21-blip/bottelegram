import { Context } from 'telegraf';
import { stateService } from '../services/state.service.js';
import { pixService } from '../services/pix.service.js';
import { createTelegramService } from '../services/telegram.service.js';

let telegramService: ReturnType<typeof createTelegramService>;

export function setPixTelegramService(service: any) {
    telegramService = service;
}

/**
 * Inicia o fluxo de geração de PIX
 */
export async function startPixFlow(ctx: Context) {
    const userId = ctx.from?.id;
    if (!userId) return;

    await stateService.setState(userId, 'ASK_PIX_CPF', {});
    await ctx.reply('💳 *Geração de PIX de Teste (R$ 0,10)*\n\nPor favor, informe o seu *CPF* para gerar o pagamento:', {
        parse_mode: 'Markdown'
    });
}

/**
 * Processa a resposta do CPF
 */
export async function handlePixCpfResponse(ctx: any, text: string) {
    const userId = ctx.from?.id;
    if (!userId) return;

    // Limpa o CPF (apenas números)
    const cpf = text.replace(/\D/g, '');

    if (cpf.length !== 11) {
        await ctx.reply('⚠️ CPF inválido. Por favor, envie o CPF com 11 dígitos (apenas números):');
        return;
    }

    await ctx.reply('⏳ Gerando PIX, por favor aguarde...');

    const amount = 0.10;
    const description = 'Teste de Pagamento - Bot Telegram';
    const email = 'usuario@cliente.com'; // Pode ser capturado do banco se disponível

    const pixResult = await pixService.createPix(userId, amount, description, cpf, email);

    if (!pixResult) {
        await ctx.reply('❌ Ocorreu um erro ao gerar o PIX. Por favor, tente novamente mais tarde.');
        await stateService.reset(userId);
        return;
    }

    // Salva o ID do pagamento para conferência se necessário
    await stateService.updateTempData(userId, { payment_id: pixResult.id.toString() });

    // Envia o QR Code
    const qrCodeBuffer = Buffer.from(pixResult.qr_code_base64, 'base64');

    await ctx.replyWithPhoto(
        { source: qrCodeBuffer },
        {
            caption: `✅ *PIX Gerado com Sucesso!*\n\n💰 *Valor:* R$ 0,10\n🆔 *ID:* ${pixResult.id}\n\n*Código Copia e Cola:*`,
            parse_mode: 'Markdown'
        }
    );

    // Envia o código Copia e Cola em uma mensagem separada para facilitar a cópia
    await ctx.reply(`\`${pixResult.qr_code}\``, { parse_mode: 'Markdown' });

    await ctx.reply('🔔 Assim que o pagamento for confirmado, você receberá uma notificação aqui.');

    // Reseta o estado para IDLE
    await stateService.reset(userId);
}
