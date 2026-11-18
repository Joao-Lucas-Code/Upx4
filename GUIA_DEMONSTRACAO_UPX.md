# SENTINELA — Guia de demonstração UPX

## Iniciar localmente

Na pasta do projeto, execute:

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

Abra **http://127.0.0.1:8765/** no navegador. Para encerrar o servidor, pressione Ctrl+C. Não há instalação de pacotes nem compilação. Python serve os arquivos; Node é necessário apenas para os testes. O site também pode ser servido por outro servidor estático.

A fonte real consulta somente o endpoint já existente, sem escrever no Firebase. Internet é necessária para Firebase, Leaflet e mapas OpenStreetMap. Sem Leaflet, a interface informa indisponibilidade do mapa e mantém telemetria/simulador. A simulação de dados funciona sem acesso ao banco, mas não fornece um mapa offline.

Antes da aula, abra a página no computador de apresentação, confirme carregamento do mapa e teste os controles. Na fonte real, “Firebase acessível” não significa “ESP32 conectado”: o contrato disponível não documenta timestamp/heartbeat. A tela mostra o horário da última consulta válida no fuso de São Paulo, não inventa o horário da medição.

## Roteiro de 80–90 segundos

| Tempo | Ação e fala sugerida |
| --- | --- |
| 0–15 s | Apresente o protótipo: “O SENTINELA conecta IoT, prevenção de alagamentos e mobilidade urbana. Usamos ESP32 com Wi-Fi, sensor ultrassônico, protoboard e estrutura impressa em 3D.” |
| 15–25 s | Mostre os cards: “O sensor mede distância até a água. Quando a água sobe, essa distância diminui. A altura depende de uma referência calibrada. Aqui distinguimos distância, nível reportado e classificação recebida.” |
| 25–35 s | Clique **Iniciar demonstração**, depois **Reproduzir subida**. Aponte o rótulo **MODO SIMULAÇÃO**: “Este cenário é fictício e separado do banco real; não altera o protótipo.” |
| 35–55 s | Observe a subida durante 20 segundos, o gráfico e a mudança normal → atenção → crítico. “O alerta aparece na transição. A alternativa é destacada para ilustrar como dados de drenagem poderiam apoiar a mobilidade.” |
| 55–65 s | Clique **Reconhecer alerta**. “Os traçados são ilustrativos: não garantem vias seguras e não representam uma interdição oficial. Não enviamos SMS nem alteramos Waze ou Google Maps.” |
| 65–75 s | No seletor **Cenário**, escolha **Desconectado**. “Quando não há comunicação, o último registro permanece identificado como antigo. Não o apresentamos como leitura atual.” |
| 75–90 s | Clique **Voltar aos dados reais**. “A fonte real permanece separada. Os próximos passos são validar calibração e horário no firmware e avaliar roteamento com bloqueios confirmados. Este é um protótipo acadêmico de Cidade Inteligente.” |

## Controles e interpretação

- **Cenário:** permite escolher diretamente normal, atenção, crítico e desconectado. A seleção interrompe a reprodução.
- **Reproduzir subida:** sequência de 20 segundos. Referência fictícia de 30 cm e estados predefinidos para apresentação, não limites físicos do hardware. **Pausar subida** interrompe o cenário; reproduzir novamente reinicia a progressão.
- **Reconhecer alerta:** registra ciência local; o aviso crítico permanece. Leituras consecutivas do mesmo estado não geram novos alertas. Uma nova entrada no estado crítico habilita novo reconhecimento.
- **Limpar eventos visíveis:** limpa só eventos da fonte selecionada. Não apaga medições, não reinicia classificação e não altera Firebase.
- **Voltar aos dados reais:** restaura indicadores, consultas e eventos reais. O polling real continua em segundo plano durante a demonstração. Ao abrir uma nova demonstração, o cenário começa vazio.
- **Observações da sessão:** até 120 consultas em memória e 50 eventos por fonte; recarregar apaga esse histórico. No modo real, o eixo temporal representa consultas, não horários de aquisição do sensor. Ausência de nível não é convertida em zero nem substituída pela distância.
- **Status não reconhecido:** aparece explicitamente sem cor de segurança. Confirmar o vocabulário real do firmware antes de ampliar o reconhecimento.

## Verificação antes da apresentação

1. Em desktop, tablet e celular (por exemplo, 1440, 768 e 390 px), conferir ausência de cortes, leitura de textos, rolagem da página, mapa e botões. Testar também 320 px e zoom de 200%.
2. Usar Tab e Enter para acessar os controles; testar reconhecimento e retorno à fonte real.
3. Demonstrar os quatro estados; verificar que crítico destaca alternativa sem afirmar interdição.
4. Com DevTools em Offline, na fonte real, aguardar timeout (8 s) e confirmar “Dados indisponíveis”, mantendo “Último registro válido · não é atual”. Voltar Online e aguardar nova consulta (retentativa de até 30 s, além da duração da requisição).
5. Em Network, verificar que o único acesso de dados ao Firebase é GET. Simulação não produz POST/PUT/PATCH/DELETE.
6. Confirmar com o grupo o firmware, calibração, vocabulário de status e regras do Firebase. Esses itens não estavam na pasta e não foram alterados.

## Testes locais

```powershell
node --check app.js
node --check telemetry.js
node --test tests/telemetry.test.js tests/dashboard.test.js
```

Os testes usam dados fictícios locais e rede simulada; não acessam produção. O harness de DOM valida comportamento e ligação dos controles, não renderização CSS. Resultados e limites da validação constam em `VALIDACAO_SENTINELA.md`.
