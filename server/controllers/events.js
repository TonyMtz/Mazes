#!/bin/env node
(function(module) {
  'use strict';

  var _ = require('underscore'),
    clients = [],
    players = require('./players'),
    rooms = require('./rooms'),
    Events = function(socket) {
      this.socket = socket;
      this.player = players.create(this.socket.id, 'Mono');
    },
    events = {
      reRenderMap: 'map_rerender',
      otherPlayerMove: 'other_move',
      otherPlayerEnter: 'other_enter',
      otherPlayerLeave: 'other_leave',
      otherPlayerOnRoom: 'room_players'
    };

  Events.prototype._getAllPlayersOnRoom = function() { // Need revisit
    var self = this,
      playersInRoom = rooms.get(this.player.room).players,
      update = [];
    playersInRoom.forEach(function(playerId) {
      if (playerId === self.player.id) return;
      var currentPlayer = players.get(playerId),
        playerData = {
          id: currentPlayer.id,
          location: {
            x: currentPlayer.location.x,
            y: currentPlayer.location.y
          }
        };
      update.push(playerData);
    });
    this.socket.emit(events.otherPlayerOnRoom, update);
  };

  Events.prototype._sendToRoom = function(eventType, updateMsg, includeSelf) { // revisited for 0.0.4
    var self = this,
      playersInRoom = rooms.get(this.player.room).players;

    playersInRoom.forEach(function(playerId) {
      if (playerId === self.player.id && !includeSelf) return;
      var client = _.find(clients, function(client) { return client.id === playerId });
      client.emit(eventType, updateMsg);
    });
  };

  Events.prototype.init = function() { // revisited for 0.0.4
    var client = this.socket,
      player = this.player;
    clients.push(client);
    players.enter2Room(player.id, rooms.getStarter().id);
    client.emit(events.reRenderMap, rooms.get(player.room).maze);
    this._sendToRoom(events.otherPlayerEnter, {
      id: player.id,
      name: player.name,
      location: {
        x: player.location.x,
        y: player.location.y
      }
    });
    this._getAllPlayersOnRoom();
  };

  Events.prototype.player_move = function(dir) {
    console.log('mode: ', dir);
    var player = players.get(this.socket.id),
      nextToDo = players.move(player.id, dir),
      update;
    if (nextToDo === 1) { // Walking
      update = {
        id: player.id,
        location: {
          x: player.location.x,
          y: player.location.y
        }
      };
      this.socket.emit('player_update', update);
    } else if (nextToDo === 2) { // Warping
      this._sendToRoom(events.otherPlayerLeave, player.id);

      var room = rooms.get(player.room),
        nextRoom = room.neighbors[dir];
      if (!nextRoom) {
        nextRoom = rooms.generateNextFor(room.id, dir).id;
      }
      rooms.deletePlayerFromRoom(player.room, player.id);
      rooms.addPlayer2Room(nextRoom, player.id);
      player.room = nextRoom;
      this.socket.emit(events.reRenderMap, rooms.get(this.player.room).maze);
      this._getAllPlayersOnRoom();
      this._sendToRoom(events.otherPlayerEnter, {
        id: player.id,
        name: player.name,
        location: {
          x: player.location.x,
          y: player.location.y
        }
      });
    }
    this._sendToRoom(events.otherPlayerMove, update);
  };

  Events.prototype.player_drop = function() {  // revisited for 0.0.4
    var self = this,
      client = this.socket,
      player = this.player,
      playersInRoom = rooms.get(player.room).players;
    rooms.deletePlayerFromRoom(player.room, player.id);
    this._sendToRoom(events.otherPlayerLeave, player.id);
    players.delete(player.id);
  };

  module.exports = Events;
})(module || this);