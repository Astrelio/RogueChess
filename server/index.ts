import 'dotenv/config'
import app from './app.js'

const port = Number(process.env.PORT || 8787)

const server = app.listen(port, () => {
  console.log(`RogueChess API on http://localhost:${port}`)
})
server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Puerto ${port} ocupado — cierra el otro proceso de la API e inténtalo de nuevo`)
    process.exit(1)
  }
  throw err
})
