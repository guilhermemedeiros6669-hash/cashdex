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
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_sn7YBbghO4Hx@ep-cool-bonus-ac98kvrr-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require',
});

// --- OPEN FINANCE (LARABANK) ---

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

// --- ROTAS ORIGINAIS ---

app.post('/cadastro-api', async (req, res) => {
  const { nome, email, cpf, senha, endereco, nascimento } = req.body;
  const cpfLimpo = cpf.replace(/\D/g, '');
  try {
    const senhaHash = await bcrypt.hash(senha, 10);
    await pool.query(
      'INSERT INTO usuarios (cpf, nome, email, senha, endereco, nascimento) VALUES ($1, $2, $3, $4, $5, $6)',
      [cpfLimpo, nome, email, senhaHash, endereco, nascimento]
    );
    res.status(201).json({ mensagem: 'Usuário cadastrado!' });
  } catch (error) {
    res.status(400).json({ erro: 'Erro ao cadastrar.' });
  }
});

app.post('/login-api', async (req, res) => {
  const { cpf, senha } = req.body;
  const cpfLimpo = cpf.replace(/\D/g, '');
  try {
    const result = await pool.query('SELECT * FROM usuarios WHERE cpf = $1', [cpfLimpo]);
    const usuario = result.rows[0];
    if (usuario && await bcrypt.compare(senha, usuario.senha)) {
      res.status(200).json({ nome: usuario.nome, cpf: usuario.cpf });
    } else {
      res.status(401).json({ erro: "CPF ou senha inválidos." });
    }
  } catch (err) {
    res.status(500).json({ erro: "Erro no servidor." });
  }
});

app.get('/saldo/:cpf', async (req, res) => {
  try {
    const result = await pool.query('SELECT saldo FROM usuarios WHERE cpf = $1', [req.params.cpf]);
    res.json({ saldo: parseFloat(result.rows[0]?.saldo || 0) });
  } catch (err) { res.status(500).send(); }
});

app.get('/extrato/:cpf', async (req, res) => {
  try {
    const result = await pool.query('SELECT tipo, valor, data_transacao FROM transacoes WHERE cpf_usuario = $1 ORDER BY data_transacao DESC LIMIT 10', [req.params.cpf]);
    res.json(result.rows);
  } catch (err) { res.status(500).send(); }
});

app.post('/deposito', async (req, res) => {
  const { cpf, valor } = req.body;
  const result = await pool.query('UPDATE usuarios SET saldo = saldo + $1 WHERE cpf = $2 RETURNING saldo', [valor, cpf]);
  await pool.query('INSERT INTO transacoes (cpf_usuario, tipo, valor) VALUES ($1, $2, $3)', [cpf, 'Depósito', valor]);
  res.json({ mensagem: "Sucesso", novoSaldo: result.rows[0].saldo });
});

app.post('/saque', async (req, res) => {
  const { cpf, valor } = req.body;
  const result = await pool.query('UPDATE usuarios SET saldo = saldo - $1 WHERE cpf = $2 RETURNING saldo', [valor, cpf]);
  await pool.query('INSERT INTO transacoes (cpf_usuario, tipo, valor) VALUES ($1, $2, $3)', [cpf, 'Saque', valor]);
  res.json({ mensagem: "Sucesso", novoSaldo: result.rows[0].saldo });
