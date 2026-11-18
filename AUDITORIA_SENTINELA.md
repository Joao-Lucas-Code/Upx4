# Auditoria SENTINELA

Data: 12/11/2026. Inspeção realizada antes das alterações em todos os arquivos existentes: `app.js`, `index.html`, `style.css`. Não há Git, manifesto de dependências, testes, firmware, relatórios, backend, regras Firebase ou arquivos de configuração na pasta recebida.

## Arquitetura encontrada e evidências

- Aplicação estática em HTML, CSS e JavaScript puro. Leaflet 1.9.4 via unpkg e mapas raster OpenStreetMap. Sem compilação.
- `app.js` faz GET REST a cada 2 s no endereço existente, caminho `/rio_sorocaba/status.json`. Não há escrita no banco pelo frontend. Espera `{ distancia, nivel_agua, porcentagem, status }`.
- A transmissão ESP32 → Firebase não está nesta pasta. Wi-Fi, método de gravação, frequência, autenticação, calibração e limites físicos precisam ser confirmados no firmware. Não é possível afirmar que o firmware usa HTTP, SDK ou este mesmo esquema apenas pelo frontend.
- O backend disponível é o serviço externo Firebase RTDB; não há código servidor local. O registro consultado representa um estado, não uma coleção histórica.
- O frontend original mostra `nivel_agua` como centímetros e `distancia` separadamente. Não calcula altura. Usa `porcentagem` sem referência de calibração verificável.
- Classificação original: crítico se `status` contém ALERTA/RISCO ou percentual ≥70; atenção se contém Atenção ou percentual ≥40; demais casos são tratados como normais. 40/70 são regras do frontend, não limites comprovados do firmware.
- Duas polylines fixas (17 e 9 pontos) compartilham início/fim. Não são resultado de roteamento. Marcador também fixo, sem geolocalização do hardware.
- Já existem atualização periódica, enquadramento das rotas, destaque de alternativa, logs por transição e aviso crítico. A execução real depende da rede e de um payload compatível.

## Falhas e lacunas

1. **Confiabilidade:** GET bem-sucedido não prova conexão do ESP32. Não há timestamp/heartbeat documentado. A última medição permanece visível indefinidamente em falhas. Ausência de validação de HTTP, tipos, null e timeout. Intervalos podem sobrepor requisições.
2. **Comunicação incorreta:** afirma SMS/push, chamada aos Bombeiros, atualização de Waze/Maps, interdição e recomendações oficiais. Nenhuma dessas integrações existe. Nível do protótipo não comprova enchente no Rio Sorocaba.
3. **Risco/calibração:** valores arbitrários do frontend podem contradizer firmware; status desconhecido cai em normal. Percentual não tem referência conhecida. Histerese física não é verificável. Limpeza de logs reinicia estado de alerta.
4. **Histórico:** somente logs em memória, sem limite; nenhum histórico de medições ou armazenamento persistente comprovado.
5. **Interface:** altura fixa e overflow oculto impedem uso em telas pequenas; mapa domina sem contexto; pulso contínuo; valores iniciais zero parecem medições; falta distinção entre dado atual e último registro.
6. **Segurança:** URL do banco é identificador público, não senha. Não há token, chave privada ou Wi-Fi nos três arquivos. GET sem autenticação depende de leitura pública autorizada nas regras. Não se pode inferir permissão de escrita disso. Regras reais não foram fornecidas. Dependências CDN e mapas exigem internet; falha do Leaflet impede toda a aplicação original.

Uma tentativa de GET somente de leitura ao caminho já usado foi bloqueada pelo ambiente (WinError 10013). Não houve acesso confirmado ao payload real, consulta administrativa, teste de escrita ou alteração de produção. Segurança das regras e compatibilidade com o hardware permanecem não verificadas.

## Coordenadas e mobilidade

Latitude entre -23.5352 e -23.4630 e longitude entre -47.4660 e -47.4360: formato válido e região compatível com Sorocaba, cuja sede consta aproximadamente em -23.5, -47.46 no [mapa municipal IBGE](https://geoftp.ibge.gov.br/cartas_e_mapas/mapas_municipais/colecao_de_mapas_municipais/2020/SP/sorocaba/3552205_MM.pdf). Isso é uma verificação regional, não de aderência viária. Não comprova que pontos seguem o rio, ruas transitáveis, vias altas ou trechos seguros. Preservar geometria e rotular como ilustrativa; localização do sensor não confirmada.

Rota ilustrativa é geometria de apresentação. Sugestão de desvio é destaque conceitual em resposta ao risco. Interdição oficial exige fonte autorizada, data, geometria e validação; hoje não existe. Nenhuma dessas ações atualiza Google Maps ou Waze.

## Cinco melhorias de maior impacto e ordem de implementação

1. Corrigir alegações, rotular protótipo/rotas e exibir dados indisponíveis sem zeros fictícios.
2. Validar payload/rede; separar disponibilidade Firebase de comunicação ESP32 e retirar aparência de leitura atual quando a idade não é comprovada.
3. Modernizar identidade SENTINELA, cards, mapa, responsividade e acessibilidade.
4. Criar demonstração isolada com normal → atenção → crítico → desconectado, destaque de alternativa e logs honestos.
5. Mostrar série de observações da sessão, limitada em memória, com horários de consulta explicitados. Não chamar isso de histórico persistido do sensor.

Implementar em etapas locais, mantendo JavaScript puro, endpoint, geometria e contrato de leitura. Risco real virá apenas de status reconhecido; remover fallback percentual 40/70 porque não é verificável no hardware. Manter nível reportado como tal, sem inventar percentual. Normal significa classificação recebida, nunca garantia de segurança viária.

## Propostas que dependem de aprovação

- **Firmware/contrato:** incluir timestamp de servidor em milissegundos, ID estável e heartbeat a cada transmissão. Definir expiração como múltiplo da frequência comprovada. Sem isso, exibir “comunicação não verificável”; valores repetidos ou alterados não comprovam idade de aquisição.
- **Calibração:** medir referência do sensor ao fundo, documentar unidade, zona morta e incerteza; altura = referência − distância dentro da faixa válida. Só então calcular percentual, validar limites e histerese física. Não implementado sem dados.
- **Persistência/múltiplos dispositivos:** propor caminho por dispositivo, retenção e regras após examinar produtores/consumidores. Agora separar estado de fonte no cliente sem migrar banco.
- **Segurança:** revisar export das regras com proprietário; restringir escrita por identidade e validar campos/ranges no servidor, testar no Emulator antes de publicar. Não aplicar regra genérica que interrompa ESP32. [Documentação Firebase](https://firebase.google.com/docs/database/security) e [REST/autenticação](https://firebase.google.com/docs/reference/rest/database).
- **Roteamento real:** openrouteservice suporta `avoid_polygons` em opções de rota ([documentação](https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/routing-options)). Uma instância própria evita nova conta, mas requer infraestrutura/dados e aprovação. Precisa de origem/destino, rede viária, polígonos validados e tratamento de “sem rota”. OSRM fornece rotas/alternativas, mas `exclude` opera categorias configuradas e não representa diretamente bloqueios arbitrários por polígono ([API](https://project-osrm.org/docs/v5.24.0/api/)). Não integrar serviços de demonstração externos nem criar contas nesta etapa.

## Riscos de regressão e critérios

- Status reais não foram observados: usar normalização de acentos/caixa e vocabulário explícito; desconhecidos devem permanecer desconhecidos, nunca normais. Confirmar com payload real antes de apresentação com hardware.
- Remoção do percentual muda classificação antiga deliberadamente. Documentar até firmware esclarecer limites.
- Sem timestamp, não prometer estado “conectado/desconectado” real do dispositivo; demonstrar desconexão apenas no simulador e identificar falha de acesso real separadamente.
- Histórico de sessão não sobrevive recarga; isso evita migração e mistura persistente. Simulação deve ter estado, histórico e eventos próprios, sem escrita remota.
- Manter aviso crítico até mudança de estado; reconhecimento não apaga evidência. Registrar transições, limitar logs e evitar notificações repetitivas.
- Validar com testes locais de estados, payloads inválidos, falhas/reconexão e isolamento; verificar servidor estático. Informar qualquer limite de teste visual/hardware.

## Escopo funcional da entrega

Real: leitura REST, validação no cliente, último registro consultado, classificação textual recebida, mapa ilustrativo e observações de sessão. Simulado: progressão de água, estados de risco e perda de comunicação em fonte separada. Planejado: calibração comprovada, timestamps do dispositivo, persistência, múltiplos sensores, roteamento com bloqueios e integrações oficiais. Hardware: ESP32, ultrassônico, protoboard e estrutura 3D; nenhum alerta físico adicionado.
