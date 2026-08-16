const express = require('express');
const pool = require('../config/db');
const checkAuth = require('../middleware/auth');
const { geocodificarEndereco } = require('../utils/geocodificacao');
const { ordenarPorProximidade } = require('../utils/distancia');

const router = express.Router();

// Todas as rotas abaixo exigem estar logado (token JWT válido)
router.use(checkAuth);

// GET /api/paradas  -> lista todas as paradas do usuário logado
router.get('/', async (req, res) => {
  try {
    const [linhas] = await pool.query(
      'SELECT * FROM paradas WHERE usuario_id = ? ORDER BY ordem_rota IS NULL, ordem_rota ASC, criado_em ASC',
      [req.usuarioId]
    );
    return res.json(linhas);
  } catch (erro) {
    console.error('Erro ao listar paradas:', erro);
    return res.status(500).json({ erro: 'Erro ao buscar as paradas.' });
  }
});

// GET /api/paradas/:id  -> detalhe de uma parada específica
router.get('/:id', async (req, res) => {
  try {
    const [linhas] = await pool.query(
      'SELECT * FROM paradas WHERE id = ? AND usuario_id = ?',
      [req.params.id, req.usuarioId]
    );
    if (linhas.length === 0) {
      return res.status(404).json({ erro: 'Parada não encontrada.' });
    }
    return res.json(linhas[0]);
  } catch (erro) {
    console.error('Erro ao buscar parada:', erro);
    return res.status(500).json({ erro: 'Erro ao buscar a parada.' });
  }
});

// POST /api/paradas  -> cria uma nova parada
router.post('/', async (req, res) => {
  try {
    const { nome_cliente, endereco, bairro, cidade, lat, lng, observacao } = req.body;

    if (!nome_cliente || !endereco) {
      return res.status(400).json({ erro: 'Cliente/local e endereço são obrigatórios.' });
    }

    const [resultado] = await pool.query(
      `INSERT INTO paradas (usuario_id, nome_cliente, endereco, bairro, cidade, lat, lng, observacao)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.usuarioId,
        nome_cliente,
        endereco,
        bairro || null,
        cidade || null,
        lat || null,
        lng || null,
        observacao || null,
      ]
    );

    const [linhas] = await pool.query('SELECT * FROM paradas WHERE id = ?', [resultado.insertId]);
    return res.status(201).json(linhas[0]);
  } catch (erro) {
    console.error('Erro ao criar parada:', erro);
    return res.status(500).json({ erro: 'Erro ao salvar a parada.' });
  }
});

// POST /api/paradas/lote  -> cria várias paradas de uma vez (usado pela importação de lista/OCR)
router.post('/lote', async (req, res) => {
  try {
    const { paradas } = req.body; // espera um array de objetos { nome_cliente, endereco, bairro, cidade, observacao }

    if (!Array.isArray(paradas) || paradas.length === 0) {
      return res.status(400).json({ erro: 'Envie um array "paradas" com pelo menos um item.' });
    }

    const validas = paradas.filter((p) => p.nome_cliente && p.endereco);
    if (validas.length === 0) {
      return res.status(400).json({ erro: 'Nenhuma parada válida (falta cliente ou endereço).' });
    }

    const valores = validas.map((p) => [
      req.usuarioId,
      p.nome_cliente,
      p.endereco,
      p.bairro || null,
      p.cidade || null,
      p.lat || null,
      p.lng || null,
      p.observacao || null,
    ]);

    await pool.query(
      `INSERT INTO paradas (usuario_id, nome_cliente, endereco, bairro, cidade, lat, lng, observacao)
       VALUES ?`,
      [valores]
    );

    const [linhas] = await pool.query(
      'SELECT * FROM paradas WHERE usuario_id = ? ORDER BY criado_em DESC LIMIT ?',
      [req.usuarioId, validas.length]
    );

    return res.status(201).json({ criadas: linhas.length, paradas: linhas });
  } catch (erro) {
    console.error('Erro ao importar paradas em lote:', erro);
    return res.status(500).json({ erro: 'Erro ao importar as paradas.' });
  }
});

// PUT /api/paradas/:id  -> edita uma parada existente
router.put('/:id', async (req, res) => {
  try {
    const { nome_cliente, endereco, bairro, cidade, lat, lng, observacao } = req.body;

    const [existe] = await pool.query(
      'SELECT id FROM paradas WHERE id = ? AND usuario_id = ?',
      [req.params.id, req.usuarioId]
    );
    if (existe.length === 0) {
      return res.status(404).json({ erro: 'Parada não encontrada.' });
    }

    await pool.query(
      `UPDATE paradas SET
         nome_cliente = COALESCE(?, nome_cliente),
         endereco = COALESCE(?, endereco),
         bairro = ?,
         cidade = ?,
         lat = ?,
         lng = ?,
         observacao = ?
       WHERE id = ? AND usuario_id = ?`,
      [
        nome_cliente || null,
        endereco || null,
        bairro || null,
        cidade || null,
        lat || null,
        lng || null,
        observacao || null,
        req.params.id,
        req.usuarioId,
      ]
    );

    const [linhas] = await pool.query('SELECT * FROM paradas WHERE id = ?', [req.params.id]);
    return res.json(linhas[0]);
  } catch (erro) {
    console.error('Erro ao editar parada:', erro);
    return res.status(500).json({ erro: 'Erro ao editar a parada.' });
  }
});

// PATCH /api/paradas/:id/status  -> muda só o status (pendente / entregue / problema)
router.patch('/:id/status', async (req, res) => {
  try {
    const { status, motivo_problema } = req.body;
    const statusValidos = ['pendente', 'entregue', 'problema'];

    if (!statusValidos.includes(status)) {
      return res.status(400).json({ erro: 'Status inválido. Use pendente, entregue ou problema.' });
    }

    const [existe] = await pool.query(
      'SELECT id FROM paradas WHERE id = ? AND usuario_id = ?',
      [req.params.id, req.usuarioId]
    );
    if (existe.length === 0) {
      return res.status(404).json({ erro: 'Parada não encontrada.' });
    }

    await pool.query(
      'UPDATE paradas SET status = ?, motivo_problema = ? WHERE id = ? AND usuario_id = ?',
      [status, status === 'problema' ? motivo_problema || null : null, req.params.id, req.usuarioId]
    );

    const [linhas] = await pool.query('SELECT * FROM paradas WHERE id = ?', [req.params.id]);
    return res.json(linhas[0]);
  } catch (erro) {
    console.error('Erro ao atualizar status:', erro);
    return res.status(500).json({ erro: 'Erro ao atualizar o status.' });
  }
});

// DELETE /api/paradas/:id  -> apaga uma parada
router.delete('/:id', async (req, res) => {
  try {
    const [resultado] = await pool.query(
      'DELETE FROM paradas WHERE id = ? AND usuario_id = ?',
      [req.params.id, req.usuarioId]
    );
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ erro: 'Parada não encontrada.' });
    }
    return res.json({ ok: true });
  } catch (erro) {
    console.error('Erro ao apagar parada:', erro);
    return res.status(500).json({ erro: 'Erro ao apagar a parada.' });
  }
});

// DELETE /api/paradas  -> apaga TODAS as paradas do usuário logado (botão "Limpar" do app)
router.delete('/', async (req, res) => {
  try {
    await pool.query('DELETE FROM paradas WHERE usuario_id = ?', [req.usuarioId]);
    return res.json({ ok: true });
  } catch (erro) {
    console.error('Erro ao limpar paradas:', erro);
    return res.status(500).json({ erro: 'Erro ao limpar as paradas.' });
  }
});

// POST /api/paradas/otimizar  -> geocodifica o que faltar e reordena por proximidade
router.post('/otimizar', async (req, res) => {
  try {
    const { baseLat, baseLng } = req.body;

    if (baseLat == null || baseLng == null) {
      return res.status(400).json({
        erro: 'Informe a latitude e longitude da base do motorista antes de otimizar.',
      });
    }

    // Só otimiza as paradas ainda pendentes — entregues/com problema
    // não fazem mais sentido entrar na ordem da rota que falta andar.
    const [paradasPendentes] = await pool.query(
      "SELECT * FROM paradas WHERE usuario_id = ? AND status = 'pendente'",
      [req.usuarioId]
    );

    if (paradasPendentes.length === 0) {
      return res.json({ otimizadas: 0, comErroDeGeocodificacao: [], mensagem: 'Nenhuma parada pendente para otimizar.' });
    }

    // 1) Geocodifica quem ainda não tem lat/lng (e guarda no banco,
    //    para não precisar geocodificar de novo da próxima vez)
    const comErroDeGeocodificacao = [];

    for (const parada of paradasPendentes) {
      if (parada.lat != null && parada.lng != null) continue; // já tem coordenadas

      try {
        const resultado = await geocodificarEndereco({
          endereco: parada.endereco,
          bairro: parada.bairro,
          cidade: parada.cidade,
        });

        if (resultado) {
          await pool.query('UPDATE paradas SET lat = ?, lng = ? WHERE id = ?', [
            resultado.lat,
            resultado.lng,
            parada.id,
          ]);
          parada.lat = resultado.lat;
          parada.lng = resultado.lng;
        } else {
          comErroDeGeocodificacao.push({ id: parada.id, nome_cliente: parada.nome_cliente });
        }
      } catch (erroGeocodificacao) {
        console.error(`Erro ao geocodificar parada ${parada.id}:`, erroGeocodificacao.message);
        comErroDeGeocodificacao.push({ id: parada.id, nome_cliente: parada.nome_cliente });
      }
    }

    // 2) Reordena por proximidade, começando da base do motorista
    const paradasOrdenadas = ordenarPorProximidade(
      parseFloat(baseLat),
      parseFloat(baseLng),
      paradasPendentes
    );

    // 3) Salva a nova ordem no banco (campo ordem_rota)
    for (let i = 0; i < paradasOrdenadas.length; i++) {
      await pool.query('UPDATE paradas SET ordem_rota = ? WHERE id = ?', [i, paradasOrdenadas[i].id]);
    }

    const [listaFinal] = await pool.query(
      'SELECT * FROM paradas WHERE usuario_id = ? ORDER BY ordem_rota IS NULL, ordem_rota ASC, criado_em ASC',
      [req.usuarioId]
    );

    return res.json({
      otimizadas: paradasOrdenadas.length,
      comErroDeGeocodificacao,
      paradas: listaFinal,
    });
  } catch (erro) {
    console.error('Erro ao otimizar rota:', erro);
    return res.status(500).json({ erro: 'Erro ao otimizar a rota.' });
  }
});

module.exports = router;
