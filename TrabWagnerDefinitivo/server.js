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
// 1. CLIENTE: VOCÊ CONECTANDO AO LARABANK
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
        res.redirect('/home?erro=falha_integracao');
    }
});

// ==========================================
// 2. CLIENTE: VOCÊ CONECTANDO AO BANCO DEAS
// ==========================================
app.get('/conectar-deas', (req, res) => {
    // Usamos o callback que seu amigo forneceu
    const redirectUri = 'https://deas-three.vercel.app/api/open-finance/callback';
    const authUrl = `https://deas-three.vercel.app/api/oauth/authorize?response_type=code&client_id=${process.env.DEAS_CLIENT_ID}&redirect_uri=${redirectUri}&scope=accounts`;
    res.redirect(authUrl);
});

// ==========================================
// 3. PROVEDOR: VOCÊ DANDO DADOS AO COLEGA (CASHDEX API)
// ==========================================
app.get('/api/oauth/authorize', (req, res) => {
    const { redirect_uri } = req.query;
    if (redirect_uri) {
        res.redirect(`${redirect_uri}?code=CASHDEX_AUTH_CODE_PROV`);
    } else {
        res.status(400).send("Redirect URI ausente.");
    }
});

app.post('/api/oauth/token', (req, res) => {
    const { client_id, client_secret } = req.body;
    if (client_id === 'cashdex_guilherme_01' && client_secret === 'secret_cashdex_2026') {
        res.json({ access_token: 'TOKEN_CASHDEX_GERADO_SUCESSO', token_type: 'Bearer' });
    } else {
        res.status(401).json({ error: 'Credenciais CashDex inválidas' });
    }
});

app.get('/api/open-finance/provider/accounts', (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader === 'Bearer TOKEN_CASHDEX_GERADO_SUCESSO') {
        res.json([{ id: '1', balance: 7500.50, currency: 'BRL', type: 'CHECKING', institution: 'CashDex' }]);
    } else {
        res.status(403).json({ error: 'Token inválido' });
    }
});

// ==========================================
// 4. API CASHDEX ORIGINAL (LOGIN, CADASTRO, OPERAÇÕES)
// ==========================================
app.post('/cadastro-api', async (req, res) => {
    const { nome, email, cpf, senha, endereco, nascimento } = req.body;
    const cpfLimpo = cpf.replace(/\D/g, '');
    try {
        const senhaHash = await bcrypt.hash(senha, 10);
        await pool.query('INSERT INTO usuarios (cpf, nome, email, senha, endereco, nascimento) VALUES ($1, $2, $3, $4, $5, $6)', [cpfLimpo, nome, email, senhaHash, endereco, nascimento]);
        res.status(201).json({ mensagem: 'Sucesso' });
    } catch (e) { res.status(400).json({ erro: 'Erro' }); }
});

app.post('/login-api', async (req, res) => {
    const { cpf, senha } = req.body;
    const cpfLimpo = cpf.replace(/\D/g, '');
    const result = await pool.query('SELECT * FROM usuarios WHERE cpf = $1', [cpfLimpo]);
    const usuario = result.rows[0];
    if (usuario && await bcrypt.compare(senha, usuario.senha)) {
        res.json({ nome: usuario.nome, cpf: usuario.cpf });
    } else { res.status(401).json({ erro: "Inválido" }); }
});

app.get('/saldo/:cpf', async (req, res) => {
    const result = await pool.query('SELECT saldo FROM usuarios WHERE cpf = $1', [req.params.cpf]);
    res.json({ saldo: parseFloat(result.rows[0]?.saldo || 0) });
});

app.get('/extrato/:cpf', async (req, res) => {
    const result = await pool.query('SELECT tipo, valor FROM transacoes WHERE cpf_usuario = $1 ORDER BY data_transacao DESC LIMIT 10', [req.params.cpf]);
    res.json(result.rows);
});

app.post('/deposito', async (req, res) => {
    const { cpf, valor } = req.body;
    const result = await pool.query('UPDATE usuarios SET saldo = saldo + $1 WHERE cpf = $2 RETURNING saldo', [valor, cpf]);
    await pool.query('INSERT INTO transacoes (cpf_usuario, tipo, valor) VALUES ($1, $2, $3)', [cpf, 'Depósito', valor]);
    res.json({ novoSaldo: result.rows[0].saldo });
});

app.post('/saque', async (req, res) => {
    const { cpf, valor } = req.body;
    const result = await pool.query('UPDATE usuarios SET saldo = saldo - $1 WHERE cpf = $2 RETURNING saldo', [valor, cpf]);
    await pool.query('INSERT INTO transacoes (cpf_usuario, tipo, valor) VALUES ($1, $2, $3)', [cpf, 'Saque', valor]);
    res.json({ novoSaldo: result.rows[0].saldo });
});

app.post('/transferencia', async (req, res) => {
    const { cpfOrigem, cpfDestino, valor } = req.body;
    await pool.query('BEGIN');
    await pool.query('UPDATE usuarios SET saldo = saldo - $1 WHERE cpf = $2', [valor, cpfOrigem]);
    await pool.query('UPDATE usuarios SET saldo = saldo + $1 WHERE cpf = $2', [valor, cpfDestino.replace(/\D/g, '')]);
    await pool.query('INSERT INTO transacoes (cpf_usuario, tipo, valor) VALUES ($1, $2, $3)', [cpfOrigem, 'Transferência', valor]);
    await pool.query('COMMIT');
    res.json({ mensagem: "Sucesso" });
});

module.exports = app;
