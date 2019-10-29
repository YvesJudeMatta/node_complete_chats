const express = require('express')
const path = require('path')
const http = require('http')
const socketio = require('socket.io')
const Filter = require('bad-words')

const { generateMessage, generateLocationMessage } = require('./utils/messages')
const { addUser, removeUser, getUser, getUsersInRoom } = require('./utils/users')

const app = express()
const server = http.createServer(app)
const io = socketio(server)

const PORT = process.env.PORT || 3000
const publicDirPath = path.join(__dirname, '../public')

app.use(express.static(publicDirPath))

// let count = 0
// server (emit) -> client (recieve) - countUpdated
// client (emit) -> server (recieve) - increment

// socket contains info of new connection
io.on('connection', (socket) => {
  console.log('new websocket connection')

  socket.on('join', (options, callback) => {
    const { error, user } = addUser({
      id: socket.id,
      ...options
    })

    if (error) {
      return callback(error)
    }

    socket.join(user.room)

    socket.emit('message', generateMessage(user.username, 'Welcome!'))
    socket.broadcast.to(user.room).emit('message', generateMessage(user.username, `${user.username} has joined!`))
    io.to(user.room).emit('roomData', {
      room: user.room,
      users: getUsersInRoom(user.room)
    })

    callback()

    // socket.emit, io.emit, socket.broadcast.emit
    // io.to.emit (everyone in specific room), socket.broadcast.to.emit (everyone in specific room) 
  })

  socket.on('sendMessage', (message, callback) => {
    const user = getUser(socket.id)

    const filter = new Filter()

    if (filter.isProfane(message)) {
      return callback('Profanity is not allowed')
    }

    io.to(user.room).emit('message', generateMessage(user.username, message))
    callback()
  })

  socket.on('sendLocation', (coords, callback) => {
    const {
      latitude,
      longitude
    } = coords || {}

    const user = getUser(socket.id)

    io.to(user.room).emit('locationMessage', generateLocationMessage(user.username, `https://google.com/maps?q=${latitude},${longitude}`))
    callback()
  })

  socket.on('disconnect', () => {
    const user = removeUser(socket.id)

    if (user) {
      io.to(user.room).emit('message', generateMessage(user.username, `${user.username} has left!`))
      io.to(user.room).emit('roomData', {
        room: user.room,
        users: getUsersInRoom(user.room)
      })
    }
  })
})

server.listen(PORT, () => {
  console.log('Server started on port: ' + PORT)
})