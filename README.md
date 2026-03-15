# 🕵️ Encontre o Impostor

Jogo online multiplayer em tempo real onde jogadores precisam descobrir quem é o impostor através de perguntas e respostas.

## 📋 Descrição do Jogo

O jogo é jogado com **5 pessoas**:
- 1 **Mestre** (quem controla o jogo)
- 4 **Jogadores** (sendo 1 impostor e 3 jogadores normais)

### Objetivo
- **Jogadores**: Descobrir quem é o impostor
- **Impostor**: Enganar os outros jogadores

## 🎮 Como Jogar

### Fase 1: Perguntas
1. O mestre cria duas perguntas diferentes:
   - **Pergunta A**: enviada para 3 jogadores
   - **Pergunta B**: enviada para 1 jogador (o impostor)
2. O mestre escolhe secretamente quem será o impostor
3. Cada jogador recebe apenas sua pergunta de forma privada
4. Jogadores podem enviar dúvidas privadas ao mestre
5. Jogadores enviam suas respostas (curtas e objetivas)

**⚠️ Importante**: Jogadores não podem revelar a pergunta que receberam, apenas a resposta!

### Fase 2: Discussão
1. Todas as respostas são reveladas simultaneamente
2. Jogadores discutem entre si para descobrir o impostor
3. **Regra**: Não podem revelar explicitamente sua pergunta
4. O mestre modera e encerra quando achar apropriado

### Fase 3: Votação
1. Cada jogador vota em quem acredita ser o impostor
2. Votos são revelados simultaneamente

**Resultado**:
- ✅ **Jogadores vencem** se o impostor for o mais votado
- 🎭 **Impostor vence** se outro jogador for mais votado ou houver empate

## 🚀 Como Executar

### Pré-requisitos
- Node.js (versão 14 ou superior)

### Instalação

1. Instale as dependências:
```bash
cd encontre-impostor
npm install
```

2. Inicie o servidor:
```bash
npm start
```

3. Abra o navegador em:
```
http://localhost:3000
```

### Para jogar online com amigos

Você pode hospedar o jogo em um servidor ou usar serviços como:
- Render
- Railway
- Heroku
- Replit

## 🎯 Funcionalidades

✅ Sistema de salas privadas com código de acesso  
✅ Comunicação em tempo real via WebSocket  
✅ Interface intuitiva e responsiva  
✅ Chat privado entre jogadores e mestre  
✅ Votação simultânea e automática  
✅ Suporte para múltiplas salas simultâneas  
✅ Sistema de fases automático  

## 🛠️ Tecnologias Utilizadas

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Backend**: Node.js, Express
- **WebSocket**: ws (biblioteca)
- **Comunicação**: Tempo real bidirecional

## 📱 Estrutura do Projeto

```
encontre-impostor/
├── server.js           # Servidor backend com WebSocket
├── package.json        # Dependências do projeto
├── public/
│   ├── index.html      # Interface principal
│   ├── css/
│   │   └── style.css   # Estilos da aplicação
│   └── js/
│       └── app.js      # Lógica do frontend
└── README.md           # Documentação
```

## 🎨 Interface

O site possui 5 telas principais:
1. **Tela Inicial**: Criar ou entrar em sala
2. **Lobby**: Aguardar jogadores e definir mestre
3. **Fase 1**: Interface de perguntas e respostas
4. **Fase 2**: Visualização de respostas e discussão
5. **Fase 3**: Votação e resultados

## 🔒 Regras Importantes

- É necessário exatamente **5 jogadores** para iniciar
- Apenas o **mestre** pode avançar as fases
- Respostas devem ser **curtas e objetivas**
- Jogadores **não podem revelar** suas perguntas
- Em caso de **empate**, o impostor vence

## 🌐 Hospedagem

Para hospedar o jogo online, você pode usar os arquivos criados e fazer deploy em qualquer serviço que suporte Node.js e WebSocket.

## 📝 Licença

Projeto de código aberto para fins educacionais e de entretenimento.

---

Divirta-se descobrindo o impostor! 🎭🕵️