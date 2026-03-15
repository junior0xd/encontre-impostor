const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static('public'));

// Estrutura de dados para gerenciar salas
const rooms = new Map();

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function broadcastToRoom(roomCode, message, excludeClient = null) {
  const room = rooms.get(roomCode);
  if (!room) return;
  
  room.players.forEach(player => {
    if (player.ws.readyState === WebSocket.OPEN && player.ws !== excludeClient) {
      player.ws.send(JSON.stringify(message));
    }
  });
}

function sendToPlayer(roomCode, playerId, message) {
  const room = rooms.get(roomCode);
  if (!room) return;
  
  const player = room.players.find(p => p.id === playerId);
  if (player && player.ws.readyState === WebSocket.OPEN) {
    player.ws.send(JSON.stringify(message));
  }
}

wss.on('connection', (ws) => {
  console.log('Nova conexão WebSocket estabelecida');
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'createRoom':
          handleCreateRoom(ws, message);
          break;
        case 'joinRoom':
          handleJoinRoom(ws, message);
          break;
        case 'setMaster':
          handleSetMaster(ws, message);
          break;
        case 'startGame':
          handleStartGame(ws, message);
          break;
        case 'sendQuestions':
          handleSendQuestions(ws, message);
          break;
        case 'submitAnswer':
          handleSubmitAnswer(ws, message);
          break;
        case 'privateQuestion':
          handlePrivateQuestion(ws, message);
          break;
        case 'privateAnswer':
          handlePrivateAnswer(ws, message);
          break;
        case 'startDiscussion':
          handleStartDiscussion(ws, message);
          break;
        case 'revealAnswers':
          handleRevealAnswers(ws, message);
          break;
        case 'startVoting':
          handleStartVoting(ws, message);
          break;
        case 'submitVote':
          handleSubmitVote(ws, message);
          break;
        case 'newRound':
          handleNewRound(ws, message);
          break;
      }
    } catch (error) {
      console.error('Erro ao processar mensagem:', error);
    }
  });
  
  ws.on('close', () => {
    handleDisconnect(ws);
  });
});

function handleCreateRoom(ws, message) {
  const roomCode = generateRoomCode();
  const playerId = Math.random().toString(36).substring(7);
  
  rooms.set(roomCode, {
    code: roomCode,
    players: [{
      id: playerId,
      name: message.playerName,
      ws: ws,
      isMaster: true
    }],
    gameState: 'lobby',
    currentPhase: null,
    impostor: null,
    questionA: '',
    questionB: '',
    answers: new Map(),
    votes: new Map()
  });
  
  ws.roomCode = roomCode;
  ws.playerId = playerId;
  
  ws.send(JSON.stringify({
    type: 'roomCreated',
    roomCode: roomCode,
    playerId: playerId,
    playerName: message.playerName
  }));
  
  updateLobby(roomCode);
}

function handleJoinRoom(ws, message) {
  const room = rooms.get(message.roomCode);
  
  if (!room) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Sala não encontrada'
    }));
    return;
  }
  
  if (room.players.length >= 5) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Sala cheia (máximo 5 jogadores)'
    }));
    return;
  }
  
  const playerId = Math.random().toString(36).substring(7);
  
  room.players.push({
    id: playerId,
    name: message.playerName,
    ws: ws,
    isMaster: false
  });
  
  ws.roomCode = message.roomCode;
  ws.playerId = playerId;
  
  ws.send(JSON.stringify({
    type: 'roomJoined',
    roomCode: message.roomCode,
    playerId: playerId,
    playerName: message.playerName
  }));
  
  updateLobby(message.roomCode);
}

function handleSetMaster(ws, message) {
  const room = rooms.get(ws.roomCode);
  if (!room) return;
  
  room.players.forEach(p => {
    p.isMaster = (p.id === message.playerId);
  });
  
  updateLobby(ws.roomCode);
}

function handleStartGame(ws, message) {
  const room = rooms.get(ws.roomCode);
  if (!room) return;
  
  const masterPlayer = room.players.find(p => p.isMaster);
  if (!masterPlayer || masterPlayer.id !== ws.playerId) return;
  
  if (room.players.length !== 5) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'É necessário exatamente 5 jogadores para iniciar'
    }));
    return;
  }
  
  room.gameState = 'questions';
  room.currentPhase = 1;
  room.answers.clear();
  room.votes.clear();
  
  broadcastToRoom(ws.roomCode, {
    type: 'gameStarted',
    phase: 1
  });
}

function handleSendQuestions(ws, message) {
  const room = rooms.get(ws.roomCode);
  if (!room) return;
  
  const masterPlayer = room.players.find(p => p.isMaster);
  if (!masterPlayer || masterPlayer.id !== ws.playerId) return;
  
  room.questionA = message.questionA;
  room.questionB = message.questionB;
  room.impostor = message.impostorId;
  
  const regularPlayers = room.players.filter(p => !p.isMaster);
  
  regularPlayers.forEach(player => {
    const question = player.id === message.impostorId ? message.questionB : message.questionA;
    sendToPlayer(ws.roomCode, player.id, {
      type: 'receiveQuestion',
      question: question,
      isImpostor: player.id === message.impostorId
    });
  });
  
  ws.send(JSON.stringify({
    type: 'questionsSent'
  }));
}

function handleSubmitAnswer(ws, message) {
  const room = rooms.get(ws.roomCode);
  if (!room) return;
  
  room.answers.set(ws.playerId, message.answer);
  
  const regularPlayers = room.players.filter(p => !p.isMaster);
  const allAnswered = regularPlayers.every(p => room.answers.has(p.id));
  
  broadcastToRoom(ws.roomCode, {
    type: 'answerSubmitted',
    playerId: ws.playerId,
    allAnswered: allAnswered
  });
}

function handlePrivateQuestion(ws, message) {
  const room = rooms.get(ws.roomCode);
  if (!room) return;
  
  const masterPlayer = room.players.find(p => p.isMaster);
  if (!masterPlayer) return;
  
  const player = room.players.find(p => p.id === ws.playerId);
  
  sendToPlayer(ws.roomCode, masterPlayer.id, {
    type: 'privateQuestionReceived',
    from: player.name,
    playerId: ws.playerId,
    question: message.question
  });
}

function handlePrivateAnswer(ws, message) {
  const room = rooms.get(ws.roomCode);
  if (!room) return;
  
  sendToPlayer(ws.roomCode, message.toPlayerId, {
    type: 'privateAnswerReceived',
    answer: message.answer
  });
}

function handleStartDiscussion(ws, message) {
  const room = rooms.get(ws.roomCode);
  if (!room) return;
  
  room.currentPhase = 2;
  
  broadcastToRoom(ws.roomCode, {
    type: 'discussionStarted',
    phase: 2
  });
}

function handleRevealAnswers(ws, message) {
  const room = rooms.get(ws.roomCode);
  if (!room) return;
  
  const answersArray = [];
  room.players.forEach(player => {
    if (!player.isMaster) {
      answersArray.push({
        playerId: player.id,
        playerName: player.name,
        answer: room.answers.get(player.id) || ''
      });
    }
  });
  
  // FIX: enviar questionA e questionB junto com as respostas
  broadcastToRoom(ws.roomCode, {
    type: 'answersRevealed',
    answers: answersArray,
    questionA: room.questionA,
    questionB: room.questionB
  });
}

function handleStartVoting(ws, message) {
  const room = rooms.get(ws.roomCode);
  if (!room) return;
  
  room.currentPhase = 3;
  room.votes.clear();
  
  broadcastToRoom(ws.roomCode, {
    type: 'votingStarted',
    phase: 3
  });
}

function handleSubmitVote(ws, message) {
  const room = rooms.get(ws.roomCode);
  if (!room) return;
  
  room.votes.set(ws.playerId, message.votedPlayerId);
  
  const regularPlayers = room.players.filter(p => !p.isMaster);
  const allVoted = regularPlayers.every(p => room.votes.has(p.id));
  
  if (allVoted) {
    calculateResults(ws.roomCode);
  } else {
    broadcastToRoom(ws.roomCode, {
      type: 'voteSubmitted',
      playerId: ws.playerId
    });
  }
}

function calculateResults(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;
  
  const voteCounts = new Map();
  room.votes.forEach((votedPlayerId) => {
    voteCounts.set(votedPlayerId, (voteCounts.get(votedPlayerId) || 0) + 1);
  });
  
  let maxVotes = 0;
  let mostVotedPlayers = [];
  
  voteCounts.forEach((count, playerId) => {
    if (count > maxVotes) {
      maxVotes = count;
      mostVotedPlayers = [playerId];
    } else if (count === maxVotes) {
      mostVotedPlayers.push(playerId);
    }
  });
  
  const impostorWins = mostVotedPlayers.length > 1 || !mostVotedPlayers.includes(room.impostor);
  
  const votesArray = [];
  room.votes.forEach((votedPlayerId, voterId) => {
    const voter = room.players.find(p => p.id === voterId);
    const voted = room.players.find(p => p.id === votedPlayerId);
    votesArray.push({
      voterName: voter.name,
      votedName: voted.name,
      votedPlayerId: votedPlayerId
    });
  });
  
  const impostorPlayer = room.players.find(p => p.id === room.impostor);
  
  broadcastToRoom(roomCode, {
    type: 'gameEnded',
    impostorWins: impostorWins,
    impostor: impostorPlayer.name,
    impostorId: room.impostor,
    votes: votesArray,
    mostVoted: mostVotedPlayers.map(id => room.players.find(p => p.id === id).name)
  });
  
  room.gameState = 'ended';
}

function handleNewRound(ws, message) {
  const room = rooms.get(ws.roomCode);
  if (!room) return;
  
  room.gameState = 'lobby';
  room.currentPhase = null;
  room.impostor = null;
  room.questionA = '';
  room.questionB = '';
  room.answers.clear();
  room.votes.clear();
  
  broadcastToRoom(ws.roomCode, {
    type: 'newRound'
  });
  
  updateLobby(ws.roomCode);
}

function updateLobby(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;
  
  const playersList = room.players.map(p => ({
    id: p.id,
    name: p.name,
    isMaster: p.isMaster
  }));
  
  broadcastToRoom(roomCode, {
    type: 'lobbyUpdate',
    players: playersList,
    roomCode: roomCode
  });
}

function handleDisconnect(ws) {
  if (!ws.roomCode) return;
  
  const room = rooms.get(ws.roomCode);
  if (!room) return;
  
  room.players = room.players.filter(p => p.ws !== ws);
  
  if (room.players.length === 0) {
    rooms.delete(ws.roomCode);
  } else {
    updateLobby(ws.roomCode);
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
