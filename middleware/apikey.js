


// Toda requisição que chega precisa trazer o header "x-api-key"
// com o valor definido em APP_API_KEY no .env.
// Isso impede que qualquer pessoa de fora chame seu backend diretamente.

require('dotenv').config();

function checkApiKey(req, res, next) {
  const chaveRecebida = req.header('x-api-key');

  if (!chaveRecebida || chaveRecebida !== process.env.APP_API_KEY) {
    return res.status(401).json({ erro: 'API key inválida ou não enviada.' });
  }

  next();
}

module.exports = checkApiKey;
