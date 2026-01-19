import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';

interface PixResult {
    id: number;
    qr_code: string;
    qr_code_base64: string;
    status: string;
}

class PixService {
    private readonly accessToken = config.mpAccessToken;
    private readonly apiUrl = 'https://api.mercadopago.com/v1/payments';

    async createPix(userId: number, amount: number, description: string, payerCpf: string, email: string, externalReference?: string): Promise<PixResult | null> {
        try {
            const response = await axios.post(
                this.apiUrl,
                {
                    transaction_amount: amount,
                    description: description,
                    payment_method_id: 'pix',
                    notification_url: config.webhookUrl + '/webhook',
                    external_reference: externalReference || userId.toString(),
                    payer: {
                        email: email,
                        identification: {
                            type: 'CPF',
                            number: payerCpf
                        }
                    }
                },
                {
                    headers: {
                        Authorization: `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json',
                        'X-Idempotency-Key': uuidv4()
                    }
                }
            );

            const data = response.data;
            const pixData = data.point_of_interaction.transaction_data;

            return {
                id: data.id,
                qr_code: pixData.qr_code,
                qr_code_base64: pixData.qr_code_base64,
                status: data.status
            };
        } catch (error: any) {
            console.error('❌ Erro ao criar PIX:', error.response?.data || error.message);
            return null;
        }
    }

    async getPaymentStatus(paymentId: string | number): Promise<any> {
        try {
            const response = await axios.get(`${this.apiUrl}/${paymentId}`, {
                headers: { Authorization: `Bearer ${this.accessToken}` }
            });
            return response.data;
        } catch (error: any) {
            console.error('❌ Erro ao consultar pagamento:', error.response?.data || error.message);
            return null;
        }
    }
}

export const pixService = new PixService();
