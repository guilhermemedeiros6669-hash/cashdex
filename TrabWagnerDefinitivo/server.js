require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcrypt');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_sn7YBbghO4Hx@ep-cool-bonus-ac98kvrr-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
});

// --- CADASTRO ---
app.post('/cadastro', async (req, res) => {
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
    res.status(400).json({ erro: 'Erro ao cadastrar. CPF ou Email já podem existir.' });
  }
});

// --- LOGIN ---
app.post('/login', async (req, res) => {
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

// --- SALDO ---
app.get('/saldo/:cpf', async (req, res) => {
  try {
    const result = await pool.query('SELECT saldo FROM usuarios WHERE cpf = $1', [req.params.cpf]);
    if (result.rows.length > 0) {
      res.json({ saldo: result.rows[0].saldo });
    } else {
      res.status(404).json({ erro: "Usuário não encontrado." });
    }
  } catch (err) {
    res.status(500).json({ erro: "Erro ao buscar saldo." });
  }
});

// --- EXTRATO ---
app.get('/extrato/:cpf', async (req, res) => {
    const { cpf } = req.params;
    try {
      const result = await pool.query(
        'SELECT tipo, valor, data_transacao FROM transacoes WHERE cpf_usuario = $1 ORDER BY data_transacao DESC LIMIT 10',
        [cpf]
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ erro: "Erro ao buscar extrato." });
    }
});

// --- DEPÓSITO / SAQUE / TRANSFERÊNCIA (Lógica mantida) ---
app.post('/deposito', async (req, res) => {
  const { cpf, valor } = req.body;
  try {
    const result = await pool.query('UPDATE usuarios SET saldo = saldo + $1 WHERE cpf = $2 RETURNING saldo', [valor, cpf]);
    await pool.query('INSERT INTO transacoes (cpf_usuario, tipo, valor) VALUES ($1, $2, $3)', [cpf, 'Depósito', valor]);
    res.json({ mensagem: "Depósito realizado!", novoSaldo: result.rows[0].saldo });
  } catch (err) { res.status(500).json({ erro: "Erro no depósito." }); }
});

app.post('/saque', async (req, res) => {
  const { cpf, valor } = req.body;
  try {
    const user = await pool.query('SELECT saldo FROM usuarios WHERE cpf = $1', [cpf]);
    if (parseFloat(user.rows[0].saldo) < valor) return res.status(400).json({ erro: "Saldo insuficiente." });
    const result = await pool.query('UPDATE usuarios SET saldo = saldo - $1 WHERE cpf = $2 RETURNING saldo', [valor, cpf]);
    await pool.query('INSERT INTO transacoes (cpf_usuario, tipo, valor) VALUES ($1, $2, $3)', [cpf, 'Saque', valor]);
    res.json({ mensagem: "Saque realizado!", novoSaldo: result.rows[0].saldo });
  } catch (err) { res.status(500).json({ erro: "Erro no saque." }); }
});

app.post('/transferencia', async (req, res) => {
  const { cpfOrigem, cpfDestino, valor } = req.body;
  const destLimpo = cpfDestino.replace(/\D/g, '');
  try {
    await pool.query('BEGIN');
    const ori = await pool.query('SELECT saldo FROM usuarios WHERE cpf = $1', [cpfOrigem]);
    if (parseFloat(ori.rows[0].saldo) < valor) throw new Error("Saldo insuficiente.");
    const des = await pool.query('SELECT nome FROM usuarios WHERE cpf = $1', [destLimpo]);
    if (des.rows.length === 0) throw new Error("Destinatário não encontrado.");
    await pool.query('UPDATE usuarios SET saldo = saldo - $1 WHERE cpf = $2', [valor, cpfOrigem]);
    await pool.query('UPDATE usuarios SET saldo = saldo + $1 WHERE cpf = $2', [valor, destLimpo]);
    await pool.query('INSERT INTO transacoes (cpf_usuario, tipo, valor) VALUES ($1, $2, $3)', [cpfOrigem, `Transferência para ${des.rows[0].nome}`, valor]);
    await pool.query('COMMIT');
    res.json({ mensagem: "Transferência realizada!" });
  } catch (err) { await pool.query('ROLLBACK'); res.status(400).json({ erro: err.message }); }
});

// ==========================================
// --- FLUXO OPEN FINANCE (OAUTH2) ---
// ==========================================

app.get('/authorize', (req, res) => {
    const authCode = "CASH-DEX-" + Math.random().toString(36).substring(7).toUpperCase();
    res.json({ mensagem: "Redirecionando para o callback...", code: authCode });
});

// ROTA DE TOKEN ATUALIZADA COM DADOS DO COLEGA
app.post('/token', (req, res) => {
    const { code, client_id, client_secret } = req.body;
    const COLEGA_CLIENT_ID = "client_8iwbj6sa";
    const COLEGA_CLIENT_SECRET = "secret_srwh9vnzsdoecxyjq7yj7";

    if (code && code.startsWith("CASH-DEX-")) {
        if (client_id === COLEGA_CLIENT_ID && client_secret === COLEGA_CLIENT_SECRET) {
            res.json({
                access_token: "TOKEN-SEGURO-" + Math.random().toString(36).substring(2),
                token_type: "Bearer",
                expires_in: 3600
            });
        } else {
            res.status(401).json({ erro: "Client ID ou Secret inválidos." });
        }
    } else {
        res.status(400).json({ erro: "Código de autorização inválido." });
    }
});

app.get('/provider/accounts', async (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer TOKEN-SEGURO-')) {
        return res.status(401).json({ erro: "Acesso não autorizado." });
    }
    try {
        const result = await pool.query('SELECT nome, email, saldo FROM usuarios LIMIT 1');
        const usuario = result.rows[0];
        res.json({ provider: "CashDex", status: "Success", data: { owner: usuario.nome, balance: usuario.saldo } });
    } catch (err) { res.status(500).json({ erro: "Erro no provedor." }); }
});

// PORTA DINÂMICA PARA VERCEL
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 CashDex Server Online na porta ${PORT}`));