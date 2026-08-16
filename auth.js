const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
require('dotenv').config();

const router = express.Router();

// POST /api/auth/register  -> cria uma conta nova
router.post('/register', async (req, res) => {
  try {
    const { nome, email, senha } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({ erro: 'Nome, e-mail e senha são obrigatórios.' });
    }
    if (senha.length < 6) {
      return res.status(400).json({ erro: 'A senha precisa ter no mínimo 6 caracteres.' });
    }

    const [existentes] = await pool.query('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (existentes.length > 0) {
      return res.status(409).json({ erro: 'Já existe uma conta com esse e-mail.' });
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    const [resultado] = await pool.query(
      'INSERT INTO usuarios (nome, email, senha_hash) VALUES (?, ?, ?)',
      [nome, email, senhaHash]
    );

    const token = jwt.sign({ usuarioId: resultado.insertId }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

    return res.status(201).json({
      token,
      usuario: { id: resultado.insertId, nome, email },
    });
  } catch (erro) {
    console.error('Erro no cadastro:', erro);
    return res.status(500).json({ erro: 'Erro ao criar conta. Tente novamente.' });
  }
});

// POST /api/auth/login  -> autentica e devolve um token
router.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ erro: 'E-mail e senha são obrigatórios.' });
    }

    const [linhas] = await pool.query(
      'SELECT id, nome, email, senha_hash FROM usuarios WHERE email = ?',
      [email]
    );

    if (linhas.length === 0) {
      return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
    }

    const usuario = linhas[0];
    const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);

    if (!senhaCorreta) {
      return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
    }

    const token = jwt.sign({ usuarioId: usuario.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

    return res.json({
      token,
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email },
    });
  } catch (erro) {
    console.error('Erro no login:', erro);
    return res.status(500).json({ erro: 'Erro ao entrar. Tente novamente.' });
  }
});

module.exports = router;
