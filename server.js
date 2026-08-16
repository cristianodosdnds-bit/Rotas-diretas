const express = require('express');
const cors = require('cors');
require('dotenv').config();

const checkApiKey = require('./middleware/apikey');
const authRoutes = require('./routes/auth');
const paradasRoutes = require('./routes/paradas');

const app = express();

app.use(cors());
app.use(express.json());

// Toda rota abaixo de /api exige a apikey do app (protege o backend de acesso externo)
app.use('/api', checkApiKey);

// Rotas de cadastro/login (não exigem estar logado, só a apikey)
app.use('/api/auth', authRoutes);

// Rotas de paradas/entregas (exigem estar logado, além da apikey)
app.use('/api/paradas', paradasRoutes);

// Rota simples para testar se o servidor está de pé
app.get('/api/status', (req, res) => {
  res.json({ ok: true, mensagem: 'Rotas Expressas backend rodando.' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Servidor Rotas Expressas rodando na porta ${PORT}`);
});
