import express from 'express'

const app = express()

app.use(express.urlencoded({ extended: false }))
app.use(express.json())

app.use('/', (req, res) => {
    res.status(200).json({ msg: "Index api working"})
})

app.listen(3000, () => console.log("Server started in port 3000"))