// Estado da aplicação
const state = {
  ws: null,
  playerId: null,
  playerName: null,
  roomCode: null,
  isMaster: false,
  isImpostor: false,
  myQuestion: null,      // pergunta recebida pelo jogador
  questionA: null,       // pergunta dos jogadores normais
  questionB: null,       // pergunta do impostor
  players: [],
  currentPhase: null
};

// Conexão WebSocket
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  
  state.ws = new WebSocket(wsUrl);

  state.ws.onopen = () => {
    console.log('Conectado ao servidor');
  };

  state.ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    handleMessage(message);
  };

  state.ws.onclose = () => {
    console.log('Desconectado do servidor');
    showError('Conexão perdida. Recarregue a página.');
  };

  state.ws.onerror = (error) => {
    console.error('Erro no WebSocket:', error);
  };
}

// Manipulador de mensagens do servidor
function handleMessage(message) {
  switch (message.type) {
    case 'roomCreated':
      state.playerId = message.playerId;
      state.playerName = message.playerName;
      state.roomCode = message.roomCode;
      showLobby();
      break;

    case 'roomJoined':
      state.playerId = message.playerId;
      state.playerName = message.playerName;
      state.roomCode = message.roomCode;
      showLobby();
      break;

    case 'lobbyUpdate':
      updateLobby(message.players, message.roomCode);
      break;

    case 'gameStarted':
      state.currentPhase = message.phase;
      showGameScreen();
      break;

    case 'receiveQuestion':
      displayQuestion(message.question, message.isImpostor);
      break;

    case 'questionsSent':
      showMasterWaiting();
      break;

    case 'answerSubmitted':
      updateAnswersStatus(message.allAnswered);
      break;

    case 'privateQuestionReceived':
      displayPrivateQuestion(message.from, message.playerId, message.question);
      break;

    case 'privateAnswerReceived':
      displayPrivateAnswer(message.answer);
      break;

    case 'discussionStarted':
      state.currentPhase = 2;
      showDiscussionPhase();
      break;

    case 'answersRevealed':
      displayAllAnswers(message.answers, message.questionA, message.questionB);
      break;

    case 'votingStarted':
      state.currentPhase = 3;
      showVotingPhase();
      break;

    case 'voteSubmitted':
      updateVotingStatus();
      break;

    case 'gameEnded':
      showResults(message);
      break;

    case 'newRound':
      resetToLobby();
      break;

    case 'error':
      showError(message.message);
      break;
  }
}

// Funções de navegação entre telas
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.remove('active');
  });
  document.getElementById(screenId).classList.add('active');
}

function showLobby() {
  showScreen('lobby-screen');
  document.getElementById('lobby-room-code').textContent = state.roomCode;
}

function showGameScreen() {
  showScreen('game-screen');
  updateGamePhaseDisplay();
}

function showResults(resultData) {
  showScreen('result-screen');

  const title = resultData.impostorWins ? '🎭 O Impostor Venceu!' : '🕵️ Jogadores Venceram!';
  document.getElementById('result-title').textContent = title;

  document.getElementById('result-impostor').textContent = `O impostor era: ${resultData.impostor}`;

  // FIX: exibir as perguntas da rodada na tela de resultado
  if (resultData.questionA || resultData.questionB) {
    const questionsDiv = document.getElementById('result-questions');
    const contentDiv = document.getElementById('result-questions-content');
    contentDiv.innerHTML = `
      <div class="result-question-row result-question-normal">
        <span class="rq-label">Pergunta A (jogadores):</span>
        <span class="rq-text">${resultData.questionA || '—'}</span>
      </div>
      <div class="result-question-row result-question-impostor">
        <span class="rq-label">Pergunta B (impostor):</span>
        <span class="rq-text">${resultData.questionB || '—'}</span>
      </div>
    `;
    questionsDiv.classList.remove('hidden');
  }

  const votesList = document.getElementById('votes-list');
  votesList.innerHTML = '';
  
  const voteCounts = {};
  resultData.votes.forEach(vote => {
    voteCounts[vote.votedName] = (voteCounts[vote.votedName] || 0) + 1;
  });

  Object.entries(voteCounts).forEach(([name, count]) => {
    const voteItem = document.createElement('p');
    voteItem.textContent = `${name}: ${count} voto(s)`;
    if (resultData.impostorId && state.players.find(p => p.name === name && p.id === resultData.impostorId)) {
      voteItem.style.fontWeight = 'bold';
      voteItem.style.color = '#e74c3c';
    }
    votesList.appendChild(voteItem);
  });
}

// Funções do Lobby
function updateLobby(players, roomCode) {
  state.players = players;
  state.roomCode = roomCode;

  const currentPlayer = players.find(p => p.id === state.playerId);
  if (currentPlayer) {
    state.isMaster = currentPlayer.isMaster;
  }

  const playersList = document.getElementById('lobby-players-list');
  playersList.innerHTML = '';

  players.forEach(player => {
    const playerDiv = document.createElement('div');
    playerDiv.className = 'player-item';
    
    const playerInfo = document.createElement('div');
    playerInfo.className = 'player-info';
    
    const playerName = document.createElement('span');
    playerName.textContent = player.name;
    if (player.isMaster) {
      playerName.textContent += ' 👑';
    }
    if (player.id === state.playerId) {
      playerName.textContent += ' (você)';
    }
    
    playerInfo.appendChild(playerName);
    playerDiv.appendChild(playerInfo);

    if (state.isMaster && !player.isMaster) {
      const setMasterBtn = document.createElement('button');
      setMasterBtn.className = 'btn btn-sm';
      setMasterBtn.textContent = 'Tornar Mestre';
      setMasterBtn.onclick = () => setMaster(player.id);
      playerDiv.appendChild(setMasterBtn);
    }

    playersList.appendChild(playerDiv);
  });

  const startBtn = document.getElementById('start-game-btn');
  if (state.isMaster && players.length === 5) {
    startBtn.disabled = false;
  } else {
    startBtn.disabled = true;
  }
}

function setMaster(playerId) {
  send({
    type: 'setMaster',
    playerId: playerId
  });
}

// Funções do Jogo
function updateGamePhaseDisplay() {
  const phaseTitles = {
    1: 'Fase 1: Perguntas',
    2: 'Fase 2: Discussão',
    3: 'Fase 3: Votação'
  };

  document.getElementById('game-phase-title').textContent = phaseTitles[state.currentPhase] || '';

  const roleBadge = document.getElementById('game-role-badge');
  if (state.isMaster) {
    roleBadge.textContent = '👑 Mestre';
    roleBadge.className = 'badge badge-master';
    document.getElementById('master-interface').classList.remove('hidden');
    document.getElementById('player-interface').classList.add('hidden');
    populateImpostorSelect();
  } else {
    // Na fase 1, não revelar o papel. Só revelar na fase 2 em diante.
    if (state.currentPhase >= 2) {
      roleBadge.textContent = state.isImpostor ? '🎭 Impostor' : '🕵️ Jogador';
      roleBadge.className = state.isImpostor ? 'badge badge-impostor' : 'badge badge-player';
    } else {
      roleBadge.textContent = '🕵️ Jogador';
      roleBadge.className = 'badge badge-player';
    }
    document.getElementById('player-interface').classList.remove('hidden');
    document.getElementById('master-interface').classList.add('hidden');
  }
}

function populateImpostorSelect() {
  const select = document.getElementById('impostor-select');
  select.innerHTML = '<option value="">Selecione...</option>';
  
  state.players.filter(p => !p.isMaster).forEach(player => {
    const option = document.createElement('option');
    option.value = player.id;
    option.textContent = player.name;
    select.appendChild(option);
  });
}

// Fase 1: Perguntas
function displayQuestion(question, isImpostor) {
  state.isImpostor = isImpostor;
  state.myQuestion = question; // salvar pergunta para usar na fase 2
  document.getElementById('player-question').textContent = question;
}

function showMasterWaiting() {
  document.getElementById('send-questions-btn').classList.add('hidden');
  document.getElementById('master-waiting').classList.remove('hidden');
  document.getElementById('private-questions-box').classList.remove('hidden');
}

function updateAnswersStatus(allAnswered) {
  const statusDiv = document.getElementById('answers-status');
  if (allAnswered) {
    statusDiv.innerHTML = '<p class="success">✅ Todos os jogadores responderam!</p>';
    document.getElementById('reveal-answers-btn').classList.remove('hidden');
  } else {
    statusDiv.innerHTML = '<p>Aguardando respostas...</p>';
  }
}

function displayPrivateQuestion(from, playerId, question) {
  const questionsList = document.getElementById('private-questions-list');
  const questionDiv = document.createElement('div');
  questionDiv.className = 'private-question-item';
  
  const questionText = document.createElement('p');
  questionText.innerHTML = `<strong>${from}:</strong> ${question}`;
  
  const answerInput = document.createElement('input');
  answerInput.type = 'text';
  answerInput.placeholder = 'Digite sua resposta...';
  
  const answerBtn = document.createElement('button');
  answerBtn.className = 'btn btn-sm';
  answerBtn.textContent = 'Responder';
  answerBtn.onclick = () => {
    send({
      type: 'privateAnswer',
      toPlayerId: playerId,
      answer: answerInput.value
    });
    questionDiv.remove();
  };
  
  questionDiv.appendChild(questionText);
  questionDiv.appendChild(answerInput);
  questionDiv.appendChild(answerBtn);
  questionsList.appendChild(questionDiv);
}

function displayPrivateAnswer(answer) {
  const answerBox = document.getElementById('private-answer-box');
  document.getElementById('private-answer-text').textContent = answer;
  answerBox.classList.remove('hidden');
}

// Fase 2: Discussão
function showDiscussionPhase() {
  if (state.isMaster) {
    document.getElementById('master-phase1').classList.add('hidden');
    document.getElementById('master-phase2').classList.remove('hidden');
  } else {
    document.getElementById('player-phase1').classList.add('hidden');
    document.getElementById('player-phase2').classList.remove('hidden');
  }
  // Agora sim revela o papel
  updateGamePhaseDisplay();
}

function displayAllAnswers(answers, questionA, questionB) {
  // Salvar as perguntas no estado para uso posterior
  state.questionA = questionA;
  state.questionB = questionB;

  const masterList = document.getElementById('revealed-answers-list');
  const playerList = document.getElementById('player-answers-list');
  
  masterList.innerHTML = '';
  playerList.innerHTML = '';

  answers.forEach(answer => {
    const answerDiv = document.createElement('div');
    answerDiv.className = 'answer-item';
    answerDiv.innerHTML = `<strong>${answer.playerName}:</strong> ${answer.answer}`;
    
    masterList.appendChild(answerDiv.cloneNode(true));
    playerList.appendChild(answerDiv);
  });

  // FIX: mostrar as perguntas para o mestre na fase de discussão
  if (state.isMaster && (questionA || questionB)) {
    const reminderDiv = document.getElementById('master-questions-reminder');
    reminderDiv.innerHTML = `
      <div class="master-q-row master-q-normal">
        <span class="q-label">Pergunta A (jogadores):</span>
        <span class="q-text">${questionA || '—'}</span>
      </div>
      <div class="master-q-row master-q-impostor">
        <span class="q-label">Pergunta B (impostor):</span>
        <span class="q-text">${questionB || '—'}</span>
      </div>
    `;
    reminderDiv.classList.remove('hidden');
  }

  // FIX: mostrar a pergunta do jogador na fase de discussão
  if (!state.isMaster && state.myQuestion) {
    const playerPhase2 = document.getElementById('player-phase2');

    // Remover bloco anterior se existir (nova rodada)
    const existingBlock = playerPhase2.querySelector('.my-question-reminder');
    if (existingBlock) existingBlock.remove();

    if (state.isImpostor) {
      // Impostor: destaque especial mostrando ambas as perguntas
      const impostorBlock = document.createElement('div');
      impostorBlock.className = 'my-question-reminder impostor-reminder';
      impostorBlock.innerHTML = `
        <div class="impostor-alert">🎭 Você é o <strong>IMPOSTOR!</strong></div>
        <div class="impostor-questions">
          <div class="question-row impostor-q">
            <span class="q-label">Sua pergunta (impostor):</span>
            <span class="q-text">${state.myQuestion}</span>
          </div>
          <div class="question-row normal-q">
            <span class="q-label">Pergunta dos outros jogadores:</span>
            <span class="q-text">${questionA || '—'}</span>
          </div>
        </div>
        <p class="impostor-tip">⚠️ Cuidado para não se trair! Suas respostas devem parecer relacionadas à pergunta dos outros.</p>
      `;
      playerPhase2.insertBefore(impostorBlock, playerPhase2.firstChild);
    } else {
      // FIX: Jogador normal: lembrete simples da sua pergunta
      const reminderBlock = document.createElement('div');
      reminderBlock.className = 'my-question-reminder normal-reminder';
      reminderBlock.innerHTML = `
        <span class="q-label">Sua pergunta era:</span>
        <span class="q-text">${state.myQuestion}</span>
      `;
      playerPhase2.insertBefore(reminderBlock, playerPhase2.firstChild);
    }
  }

  if (state.isMaster) {
    send({ type: 'startDiscussion' });
  }
}

// Fase 3: Votação
function showVotingPhase() {
  if (state.isMaster) {
    document.getElementById('master-phase2').classList.add('hidden');
    document.getElementById('master-phase3').classList.remove('hidden');
  } else {
    document.getElementById('player-phase2').classList.add('hidden');
    document.getElementById('player-phase3').classList.remove('hidden');
    displayVotingOptions();
  }
  updateGamePhaseDisplay();
}

function displayVotingOptions() {
  const votingList = document.getElementById('voting-list');
  votingList.innerHTML = '';

  state.players.filter(p => !p.isMaster).forEach(player => {
    if (player.id !== state.playerId) {
      const voteBtn = document.createElement('button');
      voteBtn.className = 'btn btn-vote';
      voteBtn.textContent = player.name;
      voteBtn.onclick = () => submitVote(player.id, voteBtn);
      votingList.appendChild(voteBtn);
    }
  });
}

function submitVote(votedPlayerId, button) {
  send({
    type: 'submitVote',
    votedPlayerId: votedPlayerId
  });

  document.getElementById('voting-list').classList.add('hidden');
  document.getElementById('vote-submitted').classList.remove('hidden');
}

function updateVotingStatus() {
  const statusDiv = document.getElementById('voting-status');
  statusDiv.innerHTML = '<p>Votos sendo contabilizados...</p>';
}

// Funções auxiliares
function send(message) {
  if (state.ws && state.ws.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify(message));
  }
}

function showError(message) {
  const errorDiv = document.getElementById('error-message');
  errorDiv.textContent = message;
  errorDiv.classList.remove('hidden');
  setTimeout(() => {
    errorDiv.classList.add('hidden');
  }, 5000);
}

function resetToLobby() {
  state.currentPhase = null;
  state.isImpostor = false;
  state.myQuestion = null;
  state.questionA = null;
  state.questionB = null;

  // Resetar fases do mestre
  document.getElementById('master-phase1').classList.remove('hidden');
  document.getElementById('master-phase2').classList.add('hidden');
  document.getElementById('master-phase3').classList.add('hidden');
  document.getElementById('master-waiting').classList.add('hidden');
  document.getElementById('send-questions-btn').classList.remove('hidden');
  document.getElementById('reveal-answers-btn').classList.add('hidden');
  document.getElementById('answers-status').innerHTML = '';
  document.getElementById('private-questions-list').innerHTML = '';
  document.getElementById('private-questions-box').classList.add('hidden');
  document.getElementById('question-a').value = '';
  document.getElementById('question-b').value = '';
  document.getElementById('impostor-select').value = '';
  // FIX: limpar lembrete de perguntas do mestre
  const masterReminder = document.getElementById('master-questions-reminder');
  masterReminder.innerHTML = '';
  masterReminder.classList.add('hidden');

  // Resetar fases do jogador
  document.getElementById('player-phase1').classList.remove('hidden');
  document.getElementById('player-phase2').classList.add('hidden');
  document.getElementById('player-phase3').classList.add('hidden');
  document.getElementById('submit-answer-btn').classList.remove('hidden');
  document.getElementById('answer-submitted').classList.add('hidden');
  document.getElementById('player-question').textContent = '';
  document.getElementById('player-answer').value = '';
  document.getElementById('private-answer-box').classList.add('hidden');
  document.getElementById('private-question-input').value = '';
  document.getElementById('vote-submitted').classList.add('hidden');
  document.getElementById('voting-list').classList.remove('hidden');

  // FIX: limpar listas de respostas e blocos de lembrete de pergunta
  document.getElementById('player-answers-list').innerHTML = '';
  document.getElementById('revealed-answers-list').innerHTML = '';
  const reminder = document.querySelector('.my-question-reminder');
  if (reminder) reminder.remove();

  // FIX: limpar seção de perguntas da tela de resultado
  document.getElementById('result-questions').classList.add('hidden');
  document.getElementById('result-questions-content').innerHTML = '';

  showLobby();
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  connectWebSocket();

  // Tela inicial
  document.getElementById('create-room-btn').addEventListener('click', () => {
    const playerName = document.getElementById('player-name').value.trim();
    if (!playerName) {
      showError('Digite seu nome');
      return;
    }
    send({ type: 'createRoom', playerName });
  });

  document.getElementById('join-room-btn').addEventListener('click', () => {
    const playerName = document.getElementById('player-name').value.trim();
    if (!playerName) {
      showError('Digite seu nome');
      return;
    }
    document.getElementById('join-room-input').classList.remove('hidden');
  });

  document.getElementById('confirm-join-btn').addEventListener('click', () => {
    const playerName = document.getElementById('player-name').value.trim();
    const roomCode = document.getElementById('room-code-input').value.trim().toUpperCase();
    if (!roomCode) {
      showError('Digite o código da sala');
      return;
    }
    send({ type: 'joinRoom', roomCode, playerName });
  });

  document.getElementById('cancel-join-btn').addEventListener('click', () => {
    document.getElementById('join-room-input').classList.add('hidden');
    document.getElementById('room-code-input').value = '';
  });

  // Lobby
  document.getElementById('start-game-btn').addEventListener('click', () => {
    send({ type: 'startGame' });
  });

  // Mestre - Fase 1
  document.getElementById('send-questions-btn').addEventListener('click', () => {
    const questionA = document.getElementById('question-a').value.trim();
    const questionB = document.getElementById('question-b').value.trim();
    const impostorId = document.getElementById('impostor-select').value;

    if (!questionA || !questionB) {
      showError('Preencha ambas as perguntas');
      return;
    }
    if (!impostorId) {
      showError('Escolha o impostor');
      return;
    }

    send({
      type: 'sendQuestions',
      questionA,
      questionB,
      impostorId
    });
  });

  document.getElementById('reveal-answers-btn').addEventListener('click', () => {
    send({ type: 'revealAnswers' });
  });

  // Jogador - Fase 1
  document.getElementById('submit-answer-btn').addEventListener('click', () => {
    const answer = document.getElementById('player-answer').value.trim();
    if (!answer) {
      showError('Digite uma resposta');
      return;
    }

    send({
      type: 'submitAnswer',
      answer
    });

    document.getElementById('submit-answer-btn').classList.add('hidden');
    document.getElementById('answer-submitted').classList.remove('hidden');
  });

  document.getElementById('send-private-question-btn').addEventListener('click', () => {
    const question = document.getElementById('private-question-input').value.trim();
    if (!question) return;

    send({
      type: 'privateQuestion',
      question
    });

    document.getElementById('private-question-input').value = '';
    showError('Dúvida enviada ao mestre');
  });

  // Mestre - Fase 2
  document.getElementById('start-voting-btn').addEventListener('click', () => {
    send({ type: 'startVoting' });
  });

  // Resultado
  document.getElementById('new-round-btn').addEventListener('click', () => {
    send({ type: 'newRound' });
  });

  document.getElementById('leave-room-btn').addEventListener('click', () => {
    location.reload();
  });
});
