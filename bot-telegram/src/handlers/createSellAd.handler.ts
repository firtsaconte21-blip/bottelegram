
import { Context, Markup } from 'telegraf';
import { stateService } from '../services/state.service.js';
import { adsService } from '../services/ads.service.js';
import { TelegramService } from '../services/telegram.service.js';
import { TempData } from '../types/index.js';

let telegramService: TelegramService;

export function setSellAdTelegramService(service: TelegramService) {
    telegramService = service;
}

/**
 * Inicia o fluxo de criação de anúncio de VENDA
 */
export async function startCreateSellAd(ctx: Context): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId) return;

    console.log(`[SELL_AD] Starting flow for user ${userId}`);
    const ok = await stateService.setState(userId, 'ASK_SELL_MILES', {});
    if (!ok) console.error(`[SELL_AD] Failed to set initial state for ${userId}`);

    await ctx.reply(
        '⚠️ *ATENÇÃO:*\nSe você deseja *VENDER* milhas, continue o preenchimento.\n\nQuantas milhas você tem disponíveis para *VENDA*?',
        { parse_mode: 'Markdown' }
    );
}

/**
 * Processa a quantidade de milhas
 * Parser: remove pontos (5.000 -> 5000)
 */
export async function handleSellMilesResponse(ctx: Context, text: string): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId) return;

    console.log(`[SELL_AD] Miles response from ${userId}: ${text}`);
    // Parser: 123.456 -> 123456
    const cleanInput = text.replace(/\./g, '');
    const miles = parseInt(cleanInput, 10);

    if (isNaN(miles) || miles <= 0) {
        await ctx.reply('❌ Número inválido. Por favor, digite a quantidade correta (ex: 5.000 ou 5000).');
        return;
    }

    if (miles < 1000) {
        await ctx.reply('⚠️ Recomendamos anunciar no mínimo 1.000 milhas. Digite novamente se quiser corrigir ou continue.');
    }

    const ok = await stateService.updateUserState(userId, 'ASK_SELL_PROGRAM', { miles });
    if (!ok) console.error(`[SELL_AD] Failed to update state to ASK_SELL_PROGRAM for ${userId}`);

    await ctx.reply(
        '🏢 *Qual programa de fidelidade você deseja VENDER milhas?*\n(selecione uma opção ou digite outro)',
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('LATAM', 'program_sell_latam'), Markup.button.callback('Smiles', 'program_sell_smiles')],
                [Markup.button.callback('Azul', 'program_sell_azul'), Markup.button.callback('Azul Interline', 'program_sell_azul_interline')],
                [Markup.button.callback('Iberia', 'program_sell_iberia'), Markup.button.callback('TAP', 'program_sell_tap')],
                [Markup.button.callback('American Airlines', 'program_sell_american'), Markup.button.callback('Copa Airlines', 'program_sell_copa')],
                [Markup.button.callback('Qatar Airways', 'program_sell_qatar'), Markup.button.callback('Air France', 'program_sell_airfrance')],
                [Markup.button.callback('KLM', 'program_sell_klm'), Markup.button.callback('Alaska Airlines', 'program_sell_alaska')],
                [Markup.button.callback('Virgin Atlantic', 'program_sell_virgin'), Markup.button.callback('Delta Air Lines', 'program_sell_delta')],
                [Markup.button.callback('United Airlines', 'program_sell_united'), Markup.button.callback('Air Canada', 'program_sell_aircanada')],
                [Markup.button.callback('Air Europa', 'program_sell_aireuropa'), Markup.button.callback('Avianca', 'program_sell_avianca')],
            ])
        }
    );
}

/**
 * Processa o programa de fidelidade
 */
export async function handleSellProgramResponse(ctx: Context, text: string): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId) return;

    let program = text.trim();

    // Se for callback, processa
    if (text.startsWith('program_sell_')) {
        program = text.replace('program_sell_', '').toUpperCase();
    } else {
        program = program.toUpperCase();
    }

    await stateService.updateUserState(userId, 'ASK_SELL_PRICE', { program });

    await ctx.reply(
        '💰 *Qual valor você deseja RECEBER por cada mil milhas?*\n(digite apenas números, ex: 26 ou 26,00)',
        { parse_mode: 'Markdown' }
    );
}

/**
 * Processa o preço
 * Parser: 26,00 -> 26.00
 */
export async function handleSellPriceResponse(ctx: Context, text: string): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId) return;

    // Parser: 26,00 -> 26.00
    const cleanInput = text.replace(',', '.');
    const price = parseFloat(cleanInput);

    await stateService.updateUserState(userId, 'CONFIRM_SELL_AD', { price, urgent: false });

    // Recupera dados para o resumo
    const state = await stateService.getState(userId);
    const data = state?.temp_data;

    if (!data || !data.miles || !data.program || !data.price) {
        await ctx.reply('❌ Erro nos dados. Vamos recomeçar.');
        await startCreateSellAd(ctx);
        return;
    }

    const total = (data.miles / 1000) * data.price;

    const summary = `
📄 *RESUMO DO ANÚNCIO DE VENDA*

Você está vendendo:
✈️ *${data.miles.toLocaleString('pt-BR')} milhas ${data.program}*
💰 *R$ ${data.price.toFixed(2)} por mil milhas*

💵 *Total estimado:* R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} + taxas

*Você confirma?*
  `.trim();

    await ctx.reply(summary, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('✅ CONFIRMO', 'confirm_sell_yes')],
            [Markup.button.callback('🔄 REINICIAR', 'confirm_sell_restart')]
        ])
    });
}

/**
 * Processa a urgência
 */


/**
 * Confirma e salva o anúncio
 */
export async function handleConfirmSellAd(ctx: Context, input: string): Promise<void> {
    const userId = ctx.from?.id;
    const username = ctx.from?.username || null;
    if (!userId) return;

    // Proteção contra re-entrada ou mensagens de texto aleatórias durante confirmação
    if (!['yes', 'restart'].includes(input)) {
        console.warn(`[SELL_AD] Ignored invalid input for confirmation: ${input}`);
        return;
    }

    // Remove botões após ação
    try {
        await ctx.editMessageReplyMarkup(undefined);
    } catch (e) {
        console.warn('[SELL_AD] Failed to clean up buttons:', e);
    }
    if (input === 'restart') {
        await startCreateSellAd(ctx);
        return;
    }

    const state = await stateService.getState(userId);
    const data = state?.temp_data;

    if (!data || !data.miles || !data.program || !data.price) {
        await ctx.reply('❌ Dados perdidos. Por favor, comece novamente.');
        await startCreateSellAd(ctx);
        return;
    }

    const ad = await adsService.createFromTempData(userId, username, {
        ...data,
        type: 'SELL', // Força tipo VENDA
        companhia: data.program, // Map program -> companhia
        quantidade: data.miles, // Map miles -> quantidade
        valor_milheiro: data.price, // Map price -> valor_milheiro
        passengers: undefined, // Explicitamente NULL
        urgent: data.urgent // Persiste a urgência
    });

    if (ad) {
        await ctx.reply(`✅ *Anúncio de VENDA criado com sucesso!*\n\n⚠️ *AVISO IMPORTANTE:*\nO SKYMILLES NÃO SE RESPONSABILIZA POR QUALQUER TRANSAÇÃO.\n\nNegocie com atenção.\nHonre os valores combinados.`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('🗑️ EXCLUIR OFERTA DE VENDA', `delete_ad_${ad.id}`)]
            ])
        });

        if (telegramService) {
            await telegramService.publishAdToGroup(ad);
        }
    } else {
        await ctx.reply('❌ Erro ao salvar anúncio. Tente novamente.');
    }

    await stateService.reset(userId);
}
