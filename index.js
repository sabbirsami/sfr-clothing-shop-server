const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.up3hj.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverApi: ServerApiVersion.v1,
});

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: "Unauthorized access" });
    }
    const token = authHeader.split(" ")[1];
    jwt.verify(token, process.env.WEB_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: "Forbidden access" });
        }
        req.decoded = decoded;
        next();
    });
}

async function run() {
    try {
        await client.connect();
        const productCollection = client.db("SFRstore").collection("products");
        const orderCollection = client.db("SFRstore").collection("orders");
        const userCollection = client.db("SFRstore").collection("users");
        console.log("connected");

        app.post("/create-payment-intent", async (req, res) => {
            const product = req.body;
            console.log(product);
            const price = product.totalCost;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ["card"],
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });

        app.put("/user/:email", async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(
                filter,
                updateDoc,
                options
            );
            const token = jwt.sign(
                { email: email },
                process.env.ACCESS_TOKEN_SECRET,
                {
                    expiresIn: "5h",
                }
            );
            res.send({ result, token });
        });

        app.get("/products", async (req, res) => {
            const query = {};
            const page = parseInt(req.query.page);
            const size = parseInt(req.query.size);
            const cursor = productCollection.find(query);
            const result = await cursor
                .skip(page * size)
                .limit(size)
                .toArray();
            res.send(result);
        });
        app.get("/productCount", async (req, res) => {
            const count = await productCollection.countDocuments();
            res.send({ count });
        });
        app.get("/products/:id", async (req, res) => {
            const id = req.params.id;
            const result = await productCollection
                .find({ _id: ObjectId(id) })
                .toArray();
            res.send(result);
        });
        app.put("/products/:id", async (req, res) => {
            const id = req.params.id;
            const product = req.body;
            const result = await productCollection.updateOne(
                { _id: ObjectId(id) },
                {
                    $set: product,
                },
                { upsert: true }
            );
            res.send({ result });
        });
        app.post("/products", async (req, res) => {
            const product = req.body;
            const result = await productCollection.insertOne(product);
            res.send(result);
        });
        app.delete("/products/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await productCollection.deleteOne(query);
            res.send(result);
        });

        app.put("/orders", async (req, res) => {
            const order = req.body;
            const newQuantity = req.body.quantity;
            const id = order.id;
            const query = { id: id };
            let quantity = order.quantity;
            const item = await orderCollection.findOne(query);
            if (item) {
                quantity = item.quantity + newQuantity;
            }
            const result = await orderCollection.updateOne(
                { id: id },
                {
                    $set: {
                        quantity: quantity,
                        id: order.id,
                        email: order.email,
                        name: order.name,
                        price: order.price,
                        total: order.total,
                        image: order.image,
                    },
                },
                { upsert: true }
            );
            res.send(result);
        });
        app.get("/orders", async (req, res) => {
            const result = await orderCollection.find().toArray();
            res.send(result);
        });
        app.get("/ordersCount", async (req, res) => {
            const count = await orderCollection.countDocuments();
            res.send({ count });
        });
        app.delete("/orders/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await orderCollection.deleteOne(query);
            res.send(result);
        });

        app.get("/allProducts/:category", async (req, res) => {
            const category = req.params.category;
            const products = await productCollection
                .find({ category: category })
                .toArray();
            res.send(products);
        });
        app.get("/orders/:email", async (req, res) => {
            const authorization = req.headers.authorization;
            console.log(authorization);
            const email = req.params.email;
            const orders = await orderCollection
                .find({ email: email })
                .toArray();

            const count = orders.length;
            let totalFinal = 0;
            {
                orders.forEach(
                    (order) => (totalFinal = order.total + totalFinal)
                );
            }
            res.send({ orders, count, totalFinal });
        });
    } finally {
    }
}
run().catch(console.dir);

app.get("/", (req, res) => {
    res.send("SFR store");
});
app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});
