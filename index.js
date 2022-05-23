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

//verifing user with jwt
function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorized access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded;
        next();
    });
}

async function run() {
    try {
        await client.connect()
        const partCollection = client.db("bits-n-bytes").collection("parts");
        const orderCollection = client.db("bits-n-bytes").collection("order");
        const userCollection = client.db("bits-n-bytes").collection("user");


        //create user with jwt and store in database
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email
            const user = req.body
            const filter = { email: email }
            const options = { upsert: true }
            const updatedDoc = {
                $set: user
            }
            const result = await userCollection.updateOne(filter, updatedDoc, options)
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ result, token })
        })

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
        app.post('/order', async (req, res) => {
            const part = req.body
            const result = await orderCollection.insertOne(part)
            res.send(result)
            console.log(result)
        })

        //updating parts quantity
        app.put('/parts/:id', async (req, res) => {
            const id = req.params.id;
            const updatedPart = req.body;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    availableQuantity: updatedPart.availableQuantity,

                }
            };
            const result = await partCollection.updateOne(filter, updatedDoc, options);
            res.send(result);

        })
        //getting my orders
        app.get('/orders', async (req, res) => {
            const email = req.query.email
            // const decodedEmail = req.decoded.email
            // if (patient === decodedEmail) {
            const query = { email: email }
            const orders = await orderCollection.find(query).toArray()
            res.send(orders)
            // }
            // else {
            //     return res.status(403).send({ message: 'Forbidden accsess' })
            // }

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