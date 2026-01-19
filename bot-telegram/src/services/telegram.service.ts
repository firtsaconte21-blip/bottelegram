import { Telegraf, Context } from 'telegraf';
import { config } from '../config/index.js';
import type { Ad } from '../types/index.js';
import { userService } from './user.service.js';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

class TelegramService {
  private bot: Telegraf;

  constructor(bot: Telegraf) {
    this.bot = bot;
  }

  /**
   * Formata a mensagem do anúncio para publicação no grupo
   */
  async formatAdMessage(ad: Ad): Promise<string> {
    const isBuy = ad.type === 'BUY';
    const actionVerb = isBuy ? 'Compro' : 'Vendo';

    // Busca dados de reputação do usuário
    const userProfile = await userService.getUserProfile(ad.user_id);

    // Formata ID do anúncio (primeiros 7 dígitos)
    const adIdShort = ad.id.slice(0, 7);

    // Formata indicações com RANGE EM NEGRITO
    const indicationsText =
      userProfile.indications < 5 ? '*menos que 5 indicações*' :
        userProfile.indications <= 10 ? '*entre 5 e 10 indicações*' :
          userProfile.indications <= 20 ? '*entre 15 e 20 indicações*' :
            userProfile.indications <= 30 ? '*entre 25 e 30 indicações*' :
              userProfile.indications <= 40 ? '*entre 35 e 40 indicações*' :
                userProfile.indications <= 50 ? '*entre 45 e 50 indicações*' :
                  '*mais de 50 indicações*';

    // Formata data de inscrição
    const memberSince = userProfile.memberSince
      ? userProfile.memberSince.toLocaleDateString('pt-BR')
      : 'N/A';

    let message = '';

    if (isBuy) {
      // Formato fluido para aproveitar a largura da imagem
      message = `${actionVerb} ${ad.quantidade.toLocaleString('pt-BR')} milhas *${ad.companhia.toUpperCase()}* para emissão com *${ad.passengers || 1} CPF*. ${actionVerb} por *R$ ${ad.valor_milheiro.toFixed(2).replace('.', ',')}* cada mil milhas.\n\n`;

      const emissaoDesc = ad.urgent
        ? '▶️ Emissão para menos de sete dias ⚠️'
        : '▶️ Emissão para mais de sete dias: ✅';
      message += `${emissaoDesc}\n`;
      message += `▶️ Oferta de compra ${adIdShort}\n\n`;
    } else {
      // Formato para venda
      const emissaoDesc = ad.urgent
        ? '▶️ Emissão para menos de sete dias ⚠️'
        : '▶️ Emissão para mais de sete dias: ✅';
      message += `${emissaoDesc}\n`;
      message += `▶️ Oferta de venda ${adIdShort}\n\n`;
    }

    // Confiômetro
    message += `*Confiômetro:*\n`;
    message += `✅ Este usuário é verificado\n`;
    message += `🤝 Tem ${indicationsText}\n`;
    message += `⭐ ${userProfile.rating.toFixed(1)}/5.0 é a nota desta pessoa\n`;
    message += `📅 Inscrito desde ${memberSince}\n`;

    // Força a largura da bolha no mobile usando espaços invisíveis (truque de layout)
    message += `\u2800`.repeat(40);

    return message;
  }

  /**
   * Obtém o caminho do banner da companhia aérea
   */
  private getAirlineBannerPath(companhia: string): string | null {
    try {
      const name = companhia.toLowerCase().trim();
      const normalize = (s: string) => s.toLowerCase().replace(/[\s_-]/g, '');
      const cleanInput = normalize(name);

      const mapping: Record<string, string> = {
        'smiles': 'smiles-logo',
        'gol': 'smiles-logo',
        'latam': 'latam',
        'american': 'american airlines',
        'copa': 'Copa_airlines_logo',
        'qatar': 'Qatar_Airways',
        'airfrance': 'Air_France',
        'alaska': 'alaska',
        'virgin': 'Virgin-Atlantic-Logo',
        'delta': 'Delta',
        'united': 'United-logo',
        'aircanada': 'Air_Canada',
        'aireuropa': 'Air_Europa_Logo_(2015).svg',
        'tap': 'tap',
        'avianca': 'avianca',
        'iberia': 'iberia',
        'klm': 'KLM',
        'azul': 'Logo_da_Azul_Linhas_Aéreas_Brasileiras'
      };

      const bannersDir = path.join(process.cwd(), '..', 'imagem banner das companhias aereas');
      const extensions = ['.png', '.jpg', '.jpeg', '.webp'];

      // 1. Tenta pelo mapeamento direto (usando nome limpo ou original)
      const targetBase = mapping[cleanInput] || mapping[name] || name.replace(/\s+/g, '_');

      for (const ext of extensions) {
        const bannerPath = path.join(bannersDir, `${targetBase}${ext}`);
        if (fs.existsSync(bannerPath)) return bannerPath;
      }

      // 2. Busca exaustiva e flexível no diretório
      if (fs.existsSync(bannersDir)) {
        const files = fs.readdirSync(bannersDir);
        const foundFile = files.find(f => {
          const fBase = normalize(path.parse(f).name);
          return fBase === cleanInput || fBase.includes(cleanInput) || cleanInput.includes(fBase);
        });

        if (foundFile) return path.join(bannersDir, foundFile);
      }

      return null;
    } catch (error) {
      console.error('Erro ao buscar banner:', error);
      return null;
    }
  }

  /**
   * Publica o anúncio no grupo do Telegram
   */
  async publishAdToGroup(ad: Ad): Promise<number | null> {
    try {
      const message = await this.formatAdMessage(ad);
      const deepLink = `https://t.me/${config.botUsername}?start=proposta_${ad.id}`;
      const bannerPath = this.getAirlineBannerPath(ad.companhia);

      const buttonText = ad.type === 'SELL'
        ? '🛒 COMPRAR DESSA OFERTA'
        : '💰 VENDER PARA ESSA OFERTA';

      const replyMarkup = {
        inline_keyboard: [
          [
            {
              text: buttonText,
              url: deepLink,
            },
          ],
        ],
      };

      let result;

      // Se houver banner, envia foto com legenda
      if (bannerPath && fs.existsSync(bannerPath)) {
        console.log(`📸 Enviando anúncio com banner: ${bannerPath}`);
        result = await this.bot.telegram.sendPhoto(
          config.telegramGroupId,
          { source: bannerPath },
          {
            caption: message,
            parse_mode: 'Markdown',
            reply_markup: replyMarkup,
          }
        );
      } else {
        // Caso contrário, envia apenas texto
        console.log(`📝 Enviando anúncio sem banner (banner não encontrado para ${ad.companhia})`);
        result = await this.bot.telegram.sendMessage(
          config.telegramGroupId,
          message,
          {
            parse_mode: 'Markdown',
            reply_markup: replyMarkup,
          }
        );
      }

      console.log(`✅ Anúncio ${ad.id} publicado no grupo`);
      return result.message_id;
    } catch (error) {
      console.error('Erro ao publicar anúncio no grupo:', error);
      return null;
    }
  }

  /**
   * Notifica o COMPRADOR sobre uma nova proposta de VENDA
   */
  async notifyBuyerNewSellerProposal(
    buyerId: number,
    ad: Ad,
    proposalId: string,
    price: number,
    quantidade: number,
    sellerId: number,
    sellerProfile: {
      username: string | null;
      rating: number;
      indications: number;
      memberSince: Date | null;
      verified: boolean;
      monthlyStats: { count: number; totalMiles: number };
    }
  ): Promise<boolean> {
    try {
      const verifiedBadge = sellerProfile.verified
        ? '✅ Usuário verificado'
        : '⚠️ Usuário não verificado';

      const indicationsRange =
        sellerProfile.indications < 5 ? 'menos de 5' :
          sellerProfile.indications <= 10 ? 'entre 5 e 10' :
            sellerProfile.indications <= 20 ? 'entre 15 e 20' :
              'mais de 20';

      const memberSince = sellerProfile.memberSince
        ? sellerProfile.memberSince.toLocaleDateString('pt-BR')
        : 'Data desconhecida';

      const message = `
📩 *Mensagem enviada ao COMPRADOR*
💰 Novo vendedor interessado em sua oferta de compra de milhas
📌 Referente à oferta nº ${ad.id.slice(0, 8)}

📊 *Detalhes da proposta*
➡️ *Quantidade ofertada:* ${quantidade.toLocaleString('pt-BR')} milhas
➡️ *Valor ofertado:* R$ ${price.toFixed(2)} por milheiro

🔎 *Sobre o vendedor*
${verifiedBadge}
⭐ Possui ${indicationsRange} indicações
🏆 *Avaliação:* ${sellerProfile.rating.toFixed(1)} / 5,0
🤝 *Negócios este mês:* ${sellerProfile.monthlyStats.count}
💠 *Milhas vendidas este mês:* ${sellerProfile.monthlyStats.totalMiles.toLocaleString('pt-BR')}
📅 *Membro da plataforma desde:* ${memberSince}

⚠️ *Atenção*
Negocie apenas se você realmente possui as milhas informadas.
As indicações falsas são monitoradas constantemente e podem resultar em exclusão do Balcão de Milhas.
      `.trim();

      await this.bot.telegram.sendMessage(buyerId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔵 ESCOLHER ESTE VENDEDOR', callback_data: `choose_seller_${proposalId}` }],
            [{ text: '🔍 Sobre este Vendedor', callback_data: `user_stats_${proposalId}` }],
            [{ text: '❌ RECUSAR OFERTA', callback_data: `reject_${proposalId}` }]
          ],
        },
      });

      return true;
    } catch (error) {
      console.error('Erro ao notificar comprador:', error);
      return false;
    }
  }

  /**
   * Envia notificação de nova proposta ao vendedor (legacy/Sell flow)
   */
  async notifySellerNewProposal(
    sellerId: number,
    ad: Ad,
    proposalId: string,
    valorProposta: number, // Preço proposto
    quantidade: number,    // Qtd proposta
    buyerId: number,       // ID do Telegram do comprador
    buyerProfile: {
      username: string | null;
      rating: number;
      indications: number;
      memberSince: Date | null;
      verified: boolean;
      monthlyStats: { count: number; totalMiles: number };
    }
  ): Promise<boolean> {
    try {
      const buyer = buyerProfile.username ? `@${buyerProfile.username}` : 'Anônimo';

      const verifiedBadge = buyerProfile.verified
        ? '✅ Usuário verificado'
        : '⚠️ Usuário não verificado';

      const indicationsRange =
        buyerProfile.indications < 5 ? 'menos de 5' :
          buyerProfile.indications <= 10 ? 'entre 5 e 10' :
            buyerProfile.indications <= 20 ? 'entre 15 e 20' :
              'mais de 20';

      const memberSince = buyerProfile.memberSince
        ? buyerProfile.memberSince.toLocaleDateString('pt-BR')
        : 'Data desconhecida';

      const message = `
🔔 *NOVA PROPOSTA RECEBIDA!*

📋 *Anúncio:* ${this.escapeMarkdown(ad.companhia)}
📊 *Quantidade proposta:* ${quantidade.toLocaleString('pt-BR')} milhas
💰 *Valor proposto:* R$ ${valorProposta.toFixed(2)} por milheiro

🔎 *Sobre o proponente*
${verifiedBadge}
👤 *Comprador:* ${buyer}
⭐ Possui ${indicationsRange} indicações
🏆 *Avaliação:* ${buyerProfile.rating.toFixed(1)} / 5,0
🤝 *Negócios este mês:* ${buyerProfile.monthlyStats.count}
💠 *Milhas compradas este mês:* ${buyerProfile.monthlyStats.totalMiles.toLocaleString('pt-BR')}
📅 *Membro da plataforma desde:* ${memberSince}

_O que você deseja fazer?_
      `.trim();

      await this.bot.telegram.sendMessage(sellerId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Aceitar Proposta', callback_data: `accept_${proposalId}` }],
            [{ text: '🔍 Sobre este Comprador', callback_data: `user_stats_${proposalId}` }],
            [{ text: '❌ Recusar Proposta', callback_data: `reject_${proposalId}` }]
          ],
        },
      });

      return true;
    } catch (error) {
      console.error('Erro ao notificar vendedor:', error);
      return false;
    }
  }

  /**
   * Notifica ambas as partes sobre proposta aceita
   */
  async notifyDealClosed(
    sellerId: number,
    sellerUsername: string | null,
    buyerId: number,
    buyerUsername: string | null,
    ad: Ad,
    valorProposta: number,
    proposalId: string
  ): Promise<void> {
    const sellerContact = sellerUsername ? `@${sellerUsername}` : `Telegram ID: ${sellerId}`;
    const buyerContact = buyerUsername ? `@${buyerUsername}` : `Telegram ID: ${buyerId}`;

    // Mensagem para o vendedor
    const sellerMessage = `
🎉 *PROPOSTA ACEITA!*

Você aceitou a proposta para o anúncio:
🏢 *${this.escapeMarkdown(ad.companhia)}* - ${ad.quantidade.toLocaleString('pt-BR')} milhas
💰 *Valor acordado:* R$ ${valorProposta.toFixed(2)} por milheiro

⚠️ _Clique abaixo para falar com o comprador e finalizar a negociação._
    `.trim();

    // Mensagem para o comprador
    const buyerMessage = `
🎉 *SUA PROPOSTA FOI ACEITA!*

O vendedor aceitou sua proposta:
🏢 *${this.escapeMarkdown(ad.companhia)}* - ${ad.quantidade.toLocaleString('pt-BR')} milhas
💰 *Valor acordado:* R$ ${valorProposta.toFixed(2)} por milheiro

⚠️ _Clique abaixo para falar com o vendedor e finalizar a negociação._
    `.trim();

    try {
      await Promise.all([
        this.bot.telegram.sendMessage(sellerId, sellerMessage, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '💬 Falar com Comprador', url: `tg://user?id=${buyerId}` }
              ],
              [
                { text: '⭐ Avaliar Comprador', callback_data: `rate_p_${proposalId}` }
              ]
            ]
          }
        }),
        this.bot.telegram.sendMessage(buyerId, buyerMessage, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '💬 Falar com Vendedor', url: `tg://user?id=${sellerId}` }
              ],
              [
                { text: '⭐ Avaliar Vendedor', callback_data: `rate_p_${proposalId}` }
              ]
            ]
          }
        }),
      ]);
    } catch (error) {
      console.error('Erro ao notificar partes sobre negócio fechado:', error);
    }
  }

  /**
   * Escapa caracteres especiais do Markdown
   */
  private escapeMarkdown(text: string): string {
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
  }

  /**
   * Notifica o comprador sobre proposta rejeitada
   */
  async notifyProposalRejected(
    buyerId: number,
    buyerUsername: string | null,
    ad: Ad,
    valorProposta: number
  ): Promise<void> {
    const message = `
❌ *SUA PROPOSTA FOI RECUSADA*

📋 *Anúncio:* ${this.escapeMarkdown(ad.companhia)} - ${ad.quantidade.toLocaleString('pt-BR')} milhas
💰 *Valor proposto:* R$ ${valorProposta.toFixed(2)} por milheiro

_Continue buscando! Existem outras oportunidades no grupo._
    `.trim();

    try {
      await this.bot.telegram.sendMessage(buyerId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 FAZER CONTRA PROPOSTA', callback_data: `prop_custom_qty_${ad.id}` }],
            [{ text: '🏠 Voltar ao Menu', callback_data: 'back_to_menu' }]
          ]
        }
      });
    } catch (error) {
      console.error('Erro ao notificar comprador sobre rejeição:', error);
    }
  }

  async sendDetailedProfile(
    chatId: number,
    targetUserId: number,
    stats: any,
    role: 'Vendedor' | 'Comprador',
    proposalId: string
  ) {
    const verifiedBadge = stats.allTime.totalRatings > 0 ? '✅ Usuário verificado' : '⚠️ Usuário não verificado';

    const message = `
📊 *CONFIÔMETRO DETALHADO* - _${role}_

✨ *Estatísticas Vitais (Total)*
👤 Avaliações recebidas: ${stats.allTime.totalRatings}
💠 Milhas compradas: ${stats.allTime.totalBought.toLocaleString('pt-BR')}
💠 Milhas vendidas: ${stats.allTime.totalSold.toLocaleString('pt-BR')}
🤝 Total de negociações: ${stats.allTime.totalNegotiations}
🏆 Nota média: ${stats.allTime.rating.toFixed(1)} / 5,0

📅 *Histórico do Mês (Reset todo dia 1º)*
🤝 Negociações: ${stats.monthly.totalNegotiations}
💠 Milhas Vendidas: ${stats.monthly.totalSold.toLocaleString('pt-BR')}
💠 Milhas Compradas: ${stats.monthly.totalBought.toLocaleString('pt-BR')}
💠 Total Negociado: ${(stats.monthly.totalSold + stats.monthly.totalBought).toLocaleString('pt-BR')}
👤 Avaliações: ${stats.monthly.totalRatings}
🏆 Média do mês: ${stats.monthly.rating.toFixed(1)} / 5,0

----------------------------------
${verifiedBadge}
_Analise com atenção antes de prosseguir._
    `.trim();

    const acceptAction = role === 'Vendedor' ? `choose_seller_${proposalId}` : `accept_${proposalId}`;

    const buttons = [
      [{ text: `🔵 ESCOLHER ESTE ${role.toUpperCase()}`, callback_data: acceptAction }],
      [{ text: '❌ RECUSAR OFERTA', callback_data: `reject_${proposalId}` }]
    ];

    await this.bot.telegram.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons }
    });
  }
}

export function createTelegramService(bot: Telegraf): TelegramService {
  return new TelegramService(bot);
}

export type { TelegramService };
