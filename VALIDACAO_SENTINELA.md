# Validação e entrega SENTINELA

Data: 12/11/2026.

## Arquivos alterados/criados

| Arquivo | Mudança |
| --- | --- |
| `index.html` | Identidade SENTINELA, indicadores sem zeros fictícios, contexto acadêmico, mapa, gráfico SVG, informações da fonte, eventos e controles de demonstração acessíveis. |
| `style.css` | Azul-marinho/ciano, estados verde/amarelo/vermelho, grades responsivas em 1050/600 px, página rolável, foco visível, redução de movimento e organização visual. |
| `app.js` | Preserva URL Firebase e coordenadas; leitura robusta, renderização independente do mapa, simulação separada, gráfico local, avisos honestos e eventos limitados. |
| `telemetry.js` | Funções puras de validação, classificação explícita, transições e estados separados; sem dependência adicional. |
| `tests/telemetry.test.js` | Regras de classificação, validação, eventos, recuperação e isolamento. |
| `tests/dashboard.test.js` | Integração dos scripts e controles com DOM mínimo/rede simulada. |
| `AUDITORIA_SENTINELA.md` | Diagnóstico prévio, riscos, prioridades e propostas sujeitas a aprovação. |
| `GUIA_DEMONSTRACAO_UPX.md` | Inicialização, roteiro de 80–90 segundos e conferência manual. |
| `VALIDACAO_SENTINELA.md` | Este registro de entrega e evidências. |

## Evidências executadas

- `node --check app.js` e `node --check telemetry.js`: passaram.
- `node --test tests/telemetry.test.js tests/dashboard.test.js`: 10 testes passaram, zero falhas. Não existiam testes anteriores.
- Servidor `python -m http.server 8765 --bind 127.0.0.1`: iniciado; HEAD `/` respondeu HTTP 200 com Content-Type text/html. Aplicação estática, sem etapa de build.
- Estados normal, atenção, crítico, desconectado simulado e indisponibilidade real: verificados no harness dos scripts de produção.
- HTTP 403, JSON null, erro de rede, valores inválidos e recuperação: verificados sem acesso à produção.
- Simulador não escreve nem mistura histórico/eventos com fonte real; retorno e polling em segundo plano verificados.
- Limpeza de eventos não remove alerta nem reinicia reconhecimento; repetição do mesmo estado não gera spam.
- Sem Leaflet, telemetria e controles inicializam com fallback de mapa.

## Limitações de verificação

- GET de produção bloqueado pelo ambiente com WinError 10013; não se confirmou payload real, regra de leitura, permissões de escrita, envio do ESP32 ou latência real. Nenhuma tentativa de escrita ou alteração de regras.
- Chrome e Edge headless foram tentados com perfis temporários separados; ambos encerraram na inicialização da GPU (erro de ambiente). Não foi possível obter captura ou validar layout visual em navegador. Responsividade foi revisada estruturalmente em CSS, mas requer conferência visual nas larguras do guia. Não se declara teste visual aprovado.
- Sem timestamp/heartbeat documentado, não é possível detectar conclusivamente desconexão do ESP32, nem sequer com Firebase respondendo. A tela real informa “ESP32 não verificável” e “idade não comprovada”, separando falha de acesso do estado físico do dispositivo. Desconexão comprovável requer a proposta de contrato da auditoria.
- História limitada à sessão, sem persistência. Sem calibração comprovada, percentual removido e altura apenas identificada como reportada. Histerese física não foi inventada; deduplicação por transição foi implementada.
- Nenhuma rua, cota, interdição, localização física do protótipo ou segurança de desvio foi confirmada. Geometrias originais preservadas e rotuladas como ilustrativas.

## Decisões de compatibilidade

Contrato de leitura mantido: distância numérica não negativa, status textual, nível numérico não negativo quando disponível. `porcentagem` não determina mais risco: os cortes 40/70 só estavam no frontend, sem evidência de calibração ou concordância com firmware. Vocabulário explícito normaliza caixa, acentos e ícones; texto não reconhecido não cai em normal. Todos os campos externos renderizam por textContent, sem HTML injetado.

Polling sequencial: 2 s após sucesso, timeout 8 s, backoff de 4/8/16/30 s após falhas. Sem sobreposição de requisições no fluxo normal, sem cache do navegador. Último registro válido permanece para inspeção, sempre identificado como registro de idade desconhecida ou antigo, nunca como nova medição. Alerta crítico anterior permanece como histórico quando dados ficam indisponíveis.

O modal anterior foi substituído por banner persistente com reconhecimento: preserva alerta visual sem bloquear uso ou fingir aviso oficial da Defesa Civil. Logs de SMS, chamadas e atualização de Waze/Maps foram removidos por falta das integrações correspondentes. Nenhum firmware, endpoint, credencial, dependência externa nova ou banco de produção foi alterado.
