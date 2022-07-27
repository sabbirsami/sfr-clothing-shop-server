const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
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
async function run() {
    try {
        await client.connect();
        const productCollection = client.db("SFRstore").collection("products");
        const orderCollection = client.db("SFRstore").collection("orders");
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
