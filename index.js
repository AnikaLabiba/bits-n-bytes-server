const express = require('express')
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express()
const port = process.env.PORT || 5000

//middleware
app.use(express.json())
app.use(cors())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zrsmd.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
console.log(uri)
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
        const reviewCollection = client.db("bits-n-bytes").collection("review");
        const paymentCollection = client.db("bits-n-bytes").collection("payment");

        //verifing admin
        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email
            const requesterAccount = await userCollection.findOne({ email: requester })
            if (requesterAccount.role === 'admin') {
                next()
            } else {
                return res.status(403).send({ message: 'Forbidden accsess' })
            }
        }

        //Payment
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const order = req.body;
            const price = order.price;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({ clientSecret: paymentIntent.client_secret })
        });

        //getting user with role admin
        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin })
        })

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
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '1d'
            });
            res.send({ result, token })
        })

        //get all user from db
        app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users);
        });

        //get user by filtering email (my profile)
        app.get('/user', verifyJWT, async (req, res) => {
            const email = req.query.email
            const decodedEmail = req.decoded.email
            if (email === decodedEmail) {
                const query = { email: email }
                const user = await userCollection.findOne(query)
                res.send(user)
            }
            else {
                return res.status(403).send({ message: 'Forbidden accsess' })
            }

        })

        //make admin
        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email

            const filter = { email: email }
            const updatedDoc = {
                $set: { role: 'admin' }
            }
            const result = await userCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })


        // //update user profile
        app.put('/user/:email', verifyJWT, async (req, res) => {
            const email = req.params.email
            const decodedEmail = req.decoded.email
            if (email === decodedEmail) {
                const filter = { email: email }
                const user = req.body
                const options = { upsert: true };
                const updatedDoc = {
                    $set: {
                        name: user.name,
                        phone: user.phone,
                        education: user.education,
                        address: user.address,
                        linkedIn: user.linkedIn,
                    },
                };
                const result = await userCollection.updateOne(filter, updatedDoc, options);
                res.send(result)
            } else {
                return res.status(403).send({ message: 'Forbidden accsess' })
            }

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

        //create part
        app.post('/part', verifyJWT, verifyAdmin, async (req, res) => {
            const part = req.body
            const result = await partCollection.insertOne(part)
            res.send(result)
        })

        //delete part
        app.delete('/part/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id
            const filter = { _id: ObjectId(id) }
            const result = await partCollection.deleteOne(filter)
            res.send(result)
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

        //get all orders
        app.get('/orders', verifyJWT, verifyAdmin, async (req, res) => {
            const orders = await orderCollection.find().toArray()
            res.send(orders)
        })

        //getting my orders by filtering email
        app.get('/order', verifyJWT, async (req, res) => {
            const email = req.query.email
            const decodedEmail = req.decoded.email
            if (email === decodedEmail) {
                const query = { email: email }
                const orders = await orderCollection.find(query).toArray()
                res.send(orders)
            }
            else {
                return res.status(403).send({ message: 'Forbidden accsess' })
            }
        })

        //get order by id
        app.get('/order/:id', verifyJWT, async (req, res) => {
            const id = req.params.id
            const query = { _id: ObjectId(id) }
            const order = await orderCollection.findOne(query)
            res.send(order)
        })

        //update order with payment info
        app.patch('/order/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }

            const result = await paymentCollection.insertOne(payment);
            const updatedOrder = await orderCollection.updateOne(filter, updatedDoc);
            res.send(updatedOrder);
        })

        //update paid order status to shipped
        app.put('/order/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const updatedStatus = req.body;
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    shipped: true
                }
            }
            const updatedOrder = await orderCollection.updateOne(filter, updatedDoc);
            res.send(updatedOrder);
        })

        //delete order
        app.delete('/order/:id', verifyJWT, async (req, res) => {
            const id = req.params.id
            const filter = { _id: ObjectId(id) }
            const result = await orderCollection.deleteOne(filter)
            res.send(result)
        })

        //create review
        app.post('/review', verifyJWT, async (req, res) => {
            const review = req.body
            const result = await reviewCollection.insertOne(review)
            res.send(result)
        })
        //get all review
        app.get('/review', async (req, res) => {
            const reviews = await reviewCollection.find().toArray()
            res.send(reviews)
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