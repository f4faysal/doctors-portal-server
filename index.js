const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();
const port = process.env.PORT || 5000;

const app = express();

// middleware
app.use(cors());
app.use(express.json());

//DB_USER = drPotal
//DB_PASSWORD = HxPZ64g8Nw0Xi87j

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.0t7ovhi.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    /***
     * API Naming Convention
     * app.get('/bookings')
     * app.get('/bookings/:id')
     * app.post('/bookings')
     * app.patch('/bookings/:id')
     * app.delete('/bookings/:id')
     */

    //------------------------------------------------------------
    const appointmentOptionCollection = client
      .db("doctorsPortal")
      .collection("appointmentOptions");

    const bookingsCollection = client
      .db("doctorsPortal")
      .collection("bookings");

    const usersCollection = client.db("doctorsPortal").collection("users");
    //------------------------------------------------------------

    //-------------------get appointment Options api-------------------------------

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
    //----------/v2/appointmentOptions---------------
    app.get("/v2/appointmentOptions", async (req, res) => {
      const date = req.query.date;
      const options = await appointmentOptionCollection
        .aggregate([
          {
            $lookup: {
              from: "bookings",
              localField: "name",
              foreignField: "treatment",
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $eq: ["$appointmentDate", date],
                    },
                  },
                },
              ],
              as: "booked",
            },
          },
          {
            $project: {
              name: 1,
              slots: 1,
              booked: {
                $map: {
                  input: "$booked",
                  as: "book",
                  in: "$$book.slot",
                },
              },
            },
          },
          {
            $project: {
              name: 1,
              slots: {
                $setDifference: ["$slots", "$booked"],
              },
            },
          },
        ])
        .toArray();
      res.send(options);
    });

    //-----------------post bookings api------------------------

    // app.post("/bookings", async (req, res) => {
    //   const booking = req.body;
    //   console.log(booking);

    //   const query = {
    //     appointmentDate: booking.appointmentDate,
    //     email: booking.email,
    //     treatment: booking.treatment,
    //   };

    //   const alreadyBooked = await bookingsCollection.find(query).toArray();

    //   if (alreadyBooked.length) {
    //     const message = `You already have a booking on ${booking.appointmentDate}`;
    //     return res.send({ acknowledged: false, message });
    //   }

    //   const result = await bookingsCollection.insertOne(booking);
    //   res.send(result);
    // });

    app.post("/bookings", async (req, res) => {
      const booking = req.body;

      const query = {
        appointmentDate: booking.appointmentDate,
        email: booking.email,
        treatment: booking.treatment,
      };

      console.log(query);
      const alreadyBooked = await bookingsCollection.find(query).toArray();

      if (alreadyBooked.length) {
        const message = `You already have a booking on ${booking.appointmentDate}`;
        return res.send({ acknowledged: false, message });
      }
      const result = await bookingsCollection.insertOne(booking);
      res.send(result);
    });

    //-----------------get bookings  for paticular email api------------------------

    app.get("/bookings", async (req, res) => {
      const email = req.query.email;
      console.log(email);
      const query = { email: email };
      const bookings = await bookingsCollection.find(query).toArray();
      res.send(bookings);
    });

    //-----------------get bookings  for paticular email api------------------------

    app.post("/users", async (req, res) => {
      const user = req.body;
      console.log(user);
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });
    
  } catch {}
}
run().catch(console.log);

app.get("/", async (req, res) => {
  res.send("doctors portal server is running");
});

app.listen(port, () => console.log(`Doctors portal running on ${port}`));
