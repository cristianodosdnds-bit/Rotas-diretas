// Verifica se o usuário está logado (token JWT válido no header "Authorization").
// Se estiver, guarda o id do usuário em req.usuarioId para as próximas rotas usarem.

const jwt = require('jsonwebtoken');
require('dotenv').config();

function checkAuth(req, res, next) {
  const authHeader = req.header('Authorization'); // formato esperado: "Bearer <token>"

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ erro: 'Token de login não enviado.' });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuarioId = payload.usuarioId;
    next();
  } catch (erro) {
    return res.status(401).json({ erro: 'Token inválido ou expirado. Faça login novamente.' });
  }
}

module.exports = checkAuth;
