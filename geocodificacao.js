// ================================================================
// Geocodificação: transforma um endereço em texto em lat/lng
// ================================================================
// Usa a Google Geocoding API, com a chave que fica no .env
// (GEOCODING_API_KEY). Essa chave é diferente da APP_API_KEY —
// aquela protege o SEU backend; esta é para o Google aceitar a
// chamada.
// ================================================================

require('dotenv').config();

/**
 * Tenta descobrir a latitude/longitude de um endereço.
 * Recebe as partes separadas (endereço, bairro, cidade) e monta um
 * texto de busca completo, para dar mais chance de acerto.
 *
 * @returns {Promise<{lat: number, lng: number, enderecoFormatado: string} | null>}
 *          null se não conseguir localizar o endereço
 */
async function geocodificarEndereco({ endereco, bairro, cidade }) {
  const chave = process.env.GEOCODING_API_KEY;

  if (!chave) {
    throw new Error('GEOCODING_API_KEY não configurada no .env do backend.');
  }

  const enderecoCompleto = [endereco, bairro, cidade, 'Brasil'].filter(Boolean).join(', ');

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', enderecoCompleto);
  url.searchParams.set('key', chave);
  url.searchParams.set('region', 'br'); // dá preferência a resultados no Brasil

  const resposta = await fetch(url.toString());
  const dados = await resposta.json();

  if (dados.status !== 'OK' || !dados.results || dados.results.length === 0) {
    return null; // não encontrou — endereço incompleto, mal escrito, etc.
  }

  const primeiroResultado = dados.results[0];

  return {
    lat: primeiroResultado.geometry.location.lat,
    lng: primeiroResultado.geometry.location.lng,
    enderecoFormatado: primeiroResultado.formatted_address,
  };
}

module.exports = { geocodificarEndereco };
