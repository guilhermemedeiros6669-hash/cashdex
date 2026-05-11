require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcrypt');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// ==========================================
// 1. CLIENTE: VOCÊ PEDINDO DADOS AO LARABANK
// ==========================================

app.get('/conectar-larabank', (req, res) => {
    const redirectUri = 'https://cashdex-ztjv.vercel.app/callback';
    const authUrl = `${process.env.LARABANK_AUTH_URL}?response_type=code&client_id=${process.env.LARABANK_CLIENT_ID}&redirect_uri=${redirectUri}&scope=accounts`;
    res.redirect(authUrl);
});

app.get('/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.redirect('/home?erro=sem_codigo');
    try {
        const response = await axios.post(process.env.LARABANK_TOKEN_URL, {
            grant_type: 'authorization_code',
            code: code,
            client_id: process.env.LARABANK_CLIENT_ID,
            client_secret: process.env.LARABANK_CLIENT_SECRET,
            redirect_uri: 'https://cashdex-ztjv.vercel.app/callback'
        });
        const token = response.data.access_token;
        const accountRes = await axios.get(process.env.LARABANK_ACCOUNTS_URL, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const conta = accountRes.data[0];
        res.redirect(`/home?conectado=true&banco=LaraBank&saldo=${conta.balance}`);
    } catch (error) {
        console.error('Erro Open Finance:', error.response?.data || error.message);
        res.redirect('/home?erro=falha_integracao');
    }
});

// ==========================================
// 2. PROVEDOR: VOCÊ DANDO DADOS AO COLEGA (CASHDEX API)
// ==========================================

// Rota: CASHDEX_AUTH_URL
app.get('/api/oauth/authorize', (req, res) => {
    const { redirect_uri } = req.query;
    // Simula autorização enviando um código fixo de volta para o colega
    if (redirect_uri) {
        res.redirect(`${redirect_uri}?code=CASHDEX_AUTH_CODE_PROV`);
    } else {
        res.status(400).send("Redirect URI ausente.");
    }
});

// Rota: CASHDEX_TOKEN_URL
app.post('/api/oauth/token', (req, res) => {
    const { client_id, client_secret } = req.body;
    // Valida as credenciais que você criou: guilherme_01 / secret_2026
    if (client_id === 'cashdex_guilherme_01' && client_secret === 'secret_cashdex_2026') {
        res.json({ access_token: 'TOKEN_CASHDEX_GERADO_SUCESSO', token_type: 'Bearer' });
    } else {
        res.status(401).json({ error: 'Credenciais CashDex inválidas' });
    }
});

// Rota: CASHDEX_ACCOUNTS_URL
app.get('/api/open-finance/provider/accounts', (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader === 'Bearer TOKEN_CASHDEX_GERADO_SUCESSO') {
        // Retorna um saldo fictício do seu banco para o colega ver
        res.json([{ id: '1', balance: 7500.50, currency: 'BRL', type: 'CHECKING', institution: 'CashDex' }]);
    } else {
        res.status(403).json({ error: 'Token inválido ou expirado' });
    }
});

// ==========================================
