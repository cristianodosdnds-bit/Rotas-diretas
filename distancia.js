// ================================================================
// Cálculo de distância e ordenação de rota por proximidade
// ================================================================

/**
 * Calcula a distância em linha reta (km) entre dois pontos de
 * latitude/longitude, usando a fórmula de Haversine (considera a
 * curvatura da Terra). Não é a distância real de estrada, mas é uma
 * boa aproximação rápida para decidir "o que está mais perto".
 */
function calcularDistanciaKm(lat1, lng1, lat2, lng2) {
  const raioTerraKm = 6371;
  const grauParaRad = (grau) => (grau * Math.PI) / 180;

  const diferencaLat = grauParaRad(lat2 - lat1);
  const diferencaLng = grauParaRad(lng2 - lng1);

  const a =
    Math.sin(diferencaLat / 2) ** 2 +
    Math.cos(grauParaRad(lat1)) * Math.cos(grauParaRad(lat2)) * Math.sin(diferencaLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return raioTerraKm * c;
}

/**
 * Recebe o ponto de partida (base do motorista) e uma lista de
 * paradas com lat/lng, e devolve essa lista reordenada usando o
 * método do "vizinho mais próximo": começa na base, vai sempre para
 * a parada mais perto de onde "está" no momento, e repete até
 * visitar todas.
 *
 * É um método simples e rápido (não é o roteiro matematicamente
 * perfeito, que seria muito mais lento de calcular), mas na prática
 * já evita ziguezague e agrupa naturalmente por bairro/cidade quando
 * as paradas de um mesmo lugar estão perto umas das outras.
 *
 * Paradas sem lat/lng (não geocodificadas) ficam no final da lista,
 * na ordem em que já estavam, para não ficarem "perdidas".
 */
function ordenarPorProximidade(baseLat, baseLng, paradas) {
  const comCoordenadas = paradas.filter((p) => p.lat != null && p.lng != null);
  const semCoordenadas = paradas.filter((p) => p.lat == null || p.lng == null);

  const restantes = [...comCoordenadas];
  const ordenadas = [];

  let pontoAtualLat = baseLat;
  let pontoAtualLng = baseLng;

  while (restantes.length > 0) {
    let indiceMaisPerto = 0;
    let menorDistancia = Infinity;

    restantes.forEach((parada, indice) => {
      const distancia = calcularDistanciaKm(pontoAtualLat, pontoAtualLng, parada.lat, parada.lng);
      if (distancia < menorDistancia) {
        menorDistancia = distancia;
        indiceMaisPerto = indice;
      }
    });

    const proximaParada = restantes.splice(indiceMaisPerto, 1)[0];
    ordenadas.push(proximaParada);

    pontoAtualLat = proximaParada.lat;
    pontoAtualLng = proximaParada.lng;
  }

  return [...ordenadas, ...semCoordenadas];
}

module.exports = { calcularDistanciaKm, ordenarPorProximidade };
