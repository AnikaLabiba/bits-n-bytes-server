const express = require('express')
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express()
const port = process.env.PORT || 5000

//middleware
app.use(express.json())
app.use(cors())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zrsmd.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect()
        const partCollection = client.db("bits-n-bytes").collection("parts");
        const orderCollection = client.db("bits-n-bytes").collection("order");

        //get all parts
        app.get('/parts', async (req, res) => {
            const parts = await partCollection.find().toArray()
            res.send(parts)
        })

        //get parts ny id
        app.get('/part/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: ObjectId(id) }
            const part = await partCollection.findOne(query)
            res.send(part)
        })

        //adding order into db
        app.post('/part', async (req, res) => {
            const part = req.body
            const result = await orderCollection.insertOne(part)
            res.send(result)
            console.log(result)
        })
    }
    finally {

    }
}
run().catch(console.dir)


app.get('/', (req, res) => {
    res.send('Hello from Bits n Bytes.')
})

app.listen(port, () => {
    console.log(`listening on port ${port}`)
})