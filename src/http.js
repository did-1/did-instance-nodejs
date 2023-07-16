import express from 'express'

const app = express()
const PORT = 3000

app.get('/', (req, res) => {
  return res.send('Hello world!')
})

app.listen(PORT, () => {
  console.log(`App llistening on port ${PORT}`)
})
