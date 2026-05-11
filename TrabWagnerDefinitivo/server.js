require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcrypt');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// Conexão com o Banco de Dados (Neon)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// --- OPEN FINANCE (LARABANK) ---

// Rota para iniciar a conexão com o LaraBank
app.get('/conectar-larabank', (req, res) => {
    const redirectUri = 'https://cashdex-ztjv.vercel.app/callback';
    const authUrl = `${process.env.LARABANK_AUTH_URL}?response_type=code&client_id=${process.env.LARABANK_CLIENT_ID}&redirect_uri=${redirectUri}&scope=accounts`;
    res.redirect(authUrl);
});

// Rota de retorno (Callback) do LaraBank
app.get('/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.redirect('/home?erro=sem_codigo');

    try {
        // Troca o código pelo Token de acesso
        const response = await axios.post(process.env.LARABANK_TOKEN_URL, {
            grant_type: 'authorization_code',
            code: code,
            client_id: process.env.LARABANK_CLIENT_ID,
            client_secret: process.env.LARABANK_CLIENT_SECRET,
            redirect_uri: 'https://cashdex-ztjv.vercel.app/callback'
        });

        const token = response.data.access_token;

        // Busca os dados da conta no LaraBank usando o Token
        const accountRes = await axios.get(process.env.LARABANK_ACCOUNTS_URL, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const conta = accountRes.data[0]; // Pega a primeira conta retornada
        
        // Redireciona para a home enviando os dados do banco externo via URL
        res.redirect(`/home?conectado=true&banco=LaraBank&saldo=${conta.balance}`);
    } catch (error) {
        console.error('Erro Open Finance:', error.response?.data || error.message);
        res.redirect('/home?erro=falha_integracao');
    }
});

// --- API DO SISTEMA BANCÁRIO (CASHDEX) ---

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
    res.status(400).json({ erro: 'Erro ao cadastrar. CPF ou Email já existem.' });
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
  try {
    const result = await pool.query('UPDATE usuarios SET saldo = saldo + $1 WHERE cpf = $2 RETURNING saldo', [valor, cpf]);
    await pool.query('INSERT INTO transacoes (cpf_usuario, tipo, valor) VALUES ($1, $2, $3)', [cpf, 'Depósito', valor]);
    res.json({ mensagem: "Sucesso", novoSaldo: result.rows[0].saldo });
  } catch (err) { res.status(500).json({ erro: "Erro ao depositar" }); }
});

app.post('/saque', async (req, res) => {
  const { cpf, valor } = req.body;
  try {
    const result = await pool.query('UPDATE usuarios SET saldo = saldo - $1 WHERE cpf = $2 RETURNING saldo', [valor, cpf]);
    await pool.query('INSERT INTO transacoes (cpf_usuario, tipo, valor) VALUES ($1, $2, $3)', [cpf, 'Saque', valor]);
    res.json({ mensagem: "Sucesso", novoSaldo: result.rows[0].saldo });
  } catch (err) { res.status(500).json({ erro: "Erro ao sacar" }); }
});

app.post('/transferencia', async (req, res) => {
  const { cpfOrigem, cpfDestino, valor } = req.body;
  const destLimpo = cpfDestino.replace(/\D/g, '');
  try {
    await pool.query('BEGIN');
    await pool.query('UPDATE usuarios SET saldo = saldo - $1 WHERE cpf = $2', [valor, cpfOrigem]);
    await pool.query('UPDATE usuarios SET saldo = saldo + $1 WHERE cpf = $2', [valor, destLimpo]);
    await pool.query('INSERT INTO transacoes (cpf_usuario, tipo, valor) VALUES ($1, $2, $3)', [cpfOrigem, `Transferência Enviada`, valor]);
    await pool.query('COMMIT');
    res.json({ mensagem: "Transferência realizada com sucesso!" });
  } catch (err) {
    await pool.query('ROLLBACK');
    res.status(500).json({ erro: "Erro na transferência" });
  }
});

module.exports = app;
