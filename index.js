const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();
const port = process.env.PORT || 5000;

const app = express();

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.0t7ovhi.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    const appointmentOptionCollection = client
      .db("doctorsPortal")
      .collection("appointmentOptions");

    const bookingsCollection = client
      .db("doctorsPortal")
      .collection("bookings");

    //get appointment Options api
    app.get("/appointmentOptions", async (req, res) => {
      const date = req.query.date;
      const query = {};
      console.log(date);
      const options = await appointmentOptionCollection.find(query).toArray();

      // //alreadyBooked  bookingQuery  optionBooked  bookedSlots  remainingSlots
      // const  bookingQuery = {bookingQuery : date}
      // const alreadyBooked = await bookingsCollection.find(bookingQuery).toArray()

      // options.forEach(option => {
      //     const optionBooked = alreadyBooked.filter(book => book.treatment=== option.name)
      //     const bookedSlots = optionBooked.map(book => book.slot)
      //     const remainingSlots = option.slot.filter(slot => !bookedSlots.includes(slot))
      //     console.log(remainingSlots.length , option.name , date)
      // })

      // get the bookings of the provided date
      const bookingQuery = { appointmentDate: date };
      const alreadyBooked = await bookingsCollection
        .find(bookingQuery)
        .toArray();

      // code carefully :D
      options.forEach((option) => {
        const optionBooked = alreadyBooked.filter(
          (book) => book.treatment === option.name
        );
        const bookedSlots = optionBooked.map((book) => book.slot);
        const remainingSlots = option.slots.filter(
          (slot) => !bookedSlots.includes(slot)
        );

        // console.log(remainingSlots.length , option.name , date)
        option.slots = remainingSlots;
      });
      res.send(options);
    });
    //post bookings api

    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      console.log(booking);
      const result = await bookingsCollection.insertOne(booking);
      res.send(result);
    });
  } catch {}
}
run().catch(console.log);

app.get("/", async (req, res) => {
  res.send("doctors portal server is running");
});

app.listen(port, () => console.log(`Doctors portal running on ${port}`));
