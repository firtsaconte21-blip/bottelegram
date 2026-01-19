import { Context, Markup } from 'telegraf';
import { stateService } from '../services/state.service.js';
import { adsService } from '../services/ads.service.js';
import { TelegramService } from '../services/telegram.service.js';

let telegramService: TelegramService;

export function setBuyAdTelegramService(service: TelegramService): void {
    telegramService = service;
}

/**
 * Inicia o fluxo de criação de anúncio de COMPRA
 */
export async function startCreateBuyAd(ctx: Context): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId) return;

    console.log(`[BUY_AD] Starting flow for user ${userId}`);
    const ok = await stateService.setState(userId, 'ASK_BUY_MILES', { type: 'BUY' });
    if (!ok) console.error(`[BUY_AD] Failed to set initial state for ${userId}`);

    await ctx.reply(
        '⚠️ *ATENÇÃO:*\n' +
        'Se você deseja *COMPRAR* milhas, continue o preenchimento.\n\n' +
        'Quantas milhas você está interessado em *COMPRAR*?\n' +
        '_(Ex: 123.670 ou 5000)_',
        { parse_mode: 'Markdown' }
    );
}

/**
 * Passo 1: Recebe a quantidade de milhas
 */
export async function handleBuyMilesResponse(ctx: Context, text: string): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId) return;

    console.log(`[BUY_AD] Miles response from ${userId}: ${text}`);
    // Tratamento de número
    const cleaned = text.replace(/\./g, "").replace(",", ".");
    const miles = parseFloat(cleaned);

    if (isNaN(miles) || miles < 1000) {
        await ctx.reply('❌ Por favor, informe um valor válido (mínimo 1.000 milhas).');
        return;
    }

    const ok = await stateService.updateUserState(userId, 'ASK_BUY_PROGRAM', { miles });
    if (!ok) console.error(`[BUY_AD] Failed to update state to ASK_BUY_PROGRAM for ${userId}`);

    await ctx.reply(
        'Qual programa de fidelidade você está interessado em adquirir milhas?\n' +
        '_(Selecione uma opção ou digite outro)_',
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('LATAM', 'program_buy_latam'), Markup.button.callback('Smiles', 'program_buy_smiles')],
                [Markup.button.callback('Azul', 'program_buy_azul'), Markup.button.callback('Azul Interline', 'program_buy_azul_interline')],
                [Markup.button.callback('Iberia', 'program_buy_iberia'), Markup.button.callback('TAP', 'program_buy_tap')],
                [Markup.button.callback('American Airlines', 'program_buy_american'), Markup.button.callback('Copa Airlines', 'program_buy_copa')],
                [Markup.button.callback('Qatar Airways', 'program_buy_qatar'), Markup.button.callback('Air France', 'program_buy_airfrance')],
                [Markup.button.callback('KLM', 'program_buy_klm'), Markup.button.callback('Alaska Airlines', 'program_buy_alaska')],
                [Markup.button.callback('Virgin Atlantic', 'program_buy_virgin'), Markup.button.callback('Delta Air Lines', 'program_buy_delta')],
                [Markup.button.callback('United Airlines', 'program_buy_united'), Markup.button.callback('Air Canada', 'program_buy_aircanada')],
                [Markup.button.callback('Air Europa', 'program_buy_aireuropa'), Markup.button.callback('Avianca', 'program_buy_avianca')],
            ])
        }
    );
}

/**
 * Passo 2: Recebe o programa de fidelidade
 */
export async function handleBuyProgramResponse(ctx: Context, text: string): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId) return;

    let program = text.trim();
    if (text.startsWith('program_buy_')) {
        program = text.replace('program_buy_', '').toUpperCase();
    } else {
        program = program.toUpperCase();
    }

    if (program.length < 2) {
        await ctx.reply('❌ Nome do programa muito curto.');
        return;
    }

    await stateService.updateUserState(userId, 'ASK_BUY_PASSENGERS', { program });

    await ctx.reply(
        'Quantos passageiros (CPFs) estarão nesta emissão?\n' +
        '_(Digite um número entre 1 e 20)_',
        { parse_mode: 'Markdown' }
    );
}

/**
 * Passo 3: Recebe a quantidade de passageiros
 */
export async function handleBuyPassengersResponse(ctx: Context, text: string): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId) return;

    const passengers = parseInt(text, 10);

    if (isNaN(passengers) || passengers < 1 || passengers > 20) {
        await ctx.reply('❌ Por favor, digite um número válido entre 1 e 20.');
        return;
    }

    await stateService.updateUserState(userId, 'ASK_BUY_URGENT', { passengers });

    await ctx.reply(
        'Nesta oferta de compra, há algum bilhete com voo programado para ocorrer em menos de 7 dias?',
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('✅ SIM (Urgente)', 'urgent_buy_yes')],
                [Markup.button.callback('❌ NÃO', 'urgent_buy_no')]
            ])
        }
    );
}

/**
 * Passo 4: Recebe a urgência
 */
export async function handleBuyUrgentResponse(ctx: Context, text: string): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId) return;

    const isUrgent = text === 'yes' || text.includes('SIM');

    await stateService.updateUserState(userId, 'ASK_BUY_PRICE', { urgent: isUrgent });

    await ctx.reply(
        'Qual valor você está disposto a pagar em cada mil milhas?\n' +
        '_(Digite apenas números. Ex: 26 ou 26,00)_',
        { parse_mode: 'Markdown' }
    );
}

/**
 * Passo 5: Recebe o preço e mostra resumo
 */
export async function handleBuyPriceResponse(ctx: Context, text: string): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId) return;

    const cleaned = text.replace(",", ".");
    const price = parseFloat(cleaned);

    if (isNaN(price) || price <= 0) {
        await ctx.reply('❌ Valor inválido. Tente novamente.');
        return;
    }

    // Salva preço e recupera todos os dados para o resumo
    await stateService.updateUserState(userId, 'CONFIRM_BUY_AD', { price });
    const state = await stateService.getState(userId);
    const data = state?.temp_data;

    if (!data) {
        await ctx.reply('❌ Erro ao recuperar dados. Use /start para reiniciar.');
        return;
    }

    const total = (data.miles! / 1000) * price;
    const urgentText = data.urgent ? '⚠️ Menos de 7 dias (Urgente)' : '⏰ Voo para mais de 7 dias';

    const summary = `
📄 *RESUMO DA OFERTA DE COMPRA*

Você está comprando:
✈️ *${data.miles!.toLocaleString('pt-BR')} milhas ${data.program}*
👤 ${data.passengers} passageiros
${urgentText}
💰 R$ ${price.toFixed(2).replace('.', ',')} por mil milhas

💵 *Total estimado:* R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} + taxas

*Você confirma?*
  `.trim();

    await ctx.reply(summary, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('✅ CONFIRMO', 'confirm_buy_yes')],
            [Markup.button.callback('🔄 REINICIAR', 'confirm_buy_restart')]
        ])
    });
}

/**
 * Passo 6: Confirma e cria o anúncio
 */
export async function handleConfirmBuyAd(ctx: Context, input: string): Promise<void> {
    const userId = ctx.from?.id;
    const username = ctx.from?.username || null;
    if (!userId) return;

    // Proteção contra re-entrada ou mensagens de texto durante confirmação
    if (!['yes', 'restart'].includes(input)) {
        console.warn(`[BUY_AD] Ignored invalid input for confirmation: ${input}`);
        return;
    }

    // Remove botões após ação
    try {
        await ctx.editMessageReplyMarkup(undefined);
    } catch (e) {
        console.warn('[BUY_AD] Failed to clean up buttons:', e);
    }

    if (input === 'restart') {
        await startCreateBuyAd(ctx);
        return;
    }

    // Se input não for 'yes' e não for restart, e não vier de botão, pode ser erro
    // Mas vamos assumir que se chegou aqui veio do botão 'yes' ou confirmação manual (menos provável com inline)

    const state = await stateService.getState(userId);
    const data = state?.temp_data;

    if (!data || !data.miles || !data.program || !data.price) {
        await ctx.reply('❌ Dados incompletos. Reiniciando...');
        await startCreateBuyAd(ctx);
        return;
    }

    // Cria anúncio no banco
    const ad = await adsService.createFromTempData(userId, username, {
        ...data,
        type: 'BUY',
        companhia: data.program, // Mapeando program -> companhia
        quantidade: data.miles,  // Mapeando miles -> quantidade
        valor_milheiro: data.price // Mapeando price -> valor_milheiro
    });

    if (ad) {
        // Publica no grupo se o serviço estiver disponível
        if (telegramService) {
            await telegramService.publishAdToGroup(ad);
        }

        await ctx.reply(
            '✅ *Anúncio de COMPRA criado com sucesso!*\n\n' +
            '⚠️ *AVISO IMPORTANTE:*\n' +
            'O SKYMILLES NÃO SE RESPONSABILIZA POR QUALQUER TRANSAÇÃO.\n' +
            'Sua função é apenas conectar compradores e vendedores.\n\n' +
            'Somente após a emissão concluída, realize o pagamento.\n' +
            'Honre sempre os acordos firmados.',
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [{ text: '🗑️ EXCLUIR OFERTA DE COMPRA', callback_data: `cancel_${ad.id}` }]
                ])
            }
        );
    } else {
        await ctx.reply('❌ Erro ao criar anúncio. Tente novamente mais tarde.');
    }

    await stateService.reset(userId);
}
