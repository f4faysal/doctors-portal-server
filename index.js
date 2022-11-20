const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const port = process.env.PORT || 5000;

const app = express();

// middleware
app.use(cors());
app.use(express.json());

// DB_USER = drPotal
// DB_PASSWORD = HxPZ64g8Nw0Xi87j
// ACCESS_TOKEN = 6ad8939f3e9b1f5d806482d70462ce4e8031b59bd793ef0fcef0b1f8c11154303580bf43437b95de9194a77b85b802be11b6cfa1b993926ea43199ed5f06fdb7

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.0t7ovhi.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

function verifyJWT(req, res, next) {
  console.log("varifay", req.headers.authorization);
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send("unauthorized access");
  }
  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}

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
    const doctorsCollection = client.db('doctorsPortal').collection('doctors');
    //------------------------------------------------------------


    // NOTE: make sure you use verifyAdmin after verifyJWT
    const verifyAdmin = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await usersCollection.findOne(query);

      if (user?.role !== 'admin') {
        return res.status(403).send({ message: 'forbidden access' })
      }
      next();
    }

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

    //----------------- get project appointmentSpecialty api------------------------
    app.get('/appointmentSpecialty', async (req, res) => {
      const query = {}
      const result = await appointmentOptionCollection.find(query).project({ name: 1 }).toArray();
      res.send(result);
    })

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

    app.get("/bookings", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;

      if (email !== decodedEmail) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { email: email };
      const bookings = await bookingsCollection.find(query).toArray();
      res.send(bookings);


    });

    //-----------------jwt email varifei------------------------

    // app.get("/jwt", async (req, res) => {
    //   const email = req.query.email;
    //   const query = {
    //     email: email,
    //   };
    //   const user = await usersCollection.findOne(query);
    //   if (user) {
    //     const token = jwt.sign({ email }, process.env.ACCESS_TOCKEN, {
    //       expiresIn: "1h",
    //     });
    //     return res.send({ accessToken: token });
    //   }
    // });

    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user) {
        const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, {
          expiresIn: "1h",
        });
        return res.send({ accessToken: token });
      }
      res.status(403).send({ accessToken: "" });
    });

    //-----------------post users  for paticular email api------------------------
    app.get("/users", async (req, res) => {
      const quary = {};
      const result = await usersCollection.find(quary).toArray();
      res.send(result);
    });


    //-----------------get users  email for paticular email api------------------------


    app.get('/users/admin/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email }
      const user = await usersCollection.findOne(query);
      res.send({ isAdmin: user?.role === 'admin' });
    })


    //-----------------post users  for paticular email api------------------------
    app.post("/users", async (req, res) => {
      const user = req.body;
      console.log(user);
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    //-----------------update a admin role------------------------

    // app.put("/users/admin/:id", async (req, res) => {
    //   const id = req.params.id;
    //   const filter = { _id: ObjectId(id) };
    //   const options = { upsert: true };

    //   const updateDoc = {
    //     $set: {
    //       role: "admin",
    //     },
    //   };


    //   const result = await usersCollection.updateOne(filter, updatedDoc, options);
    //         res.send(result);
    // });

    app.put('/users/admin/:id', verifyJWT, async (req, res) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await usersCollection.findOne(query);

      if (user?.role !== 'admin') {
        return res.status(403).send({ message: 'forbidden access' })
      }



      const id = req.params.id;
      const filter = { _id: ObjectId(id) }
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await usersCollection.updateOne(filter, updatedDoc, options);
      res.send(result);
    })


    //----------------- post doctors a  API------------------------

    app.post('/doctors', verifyJWT, verifyAdmin, async (req, res) => {
      const doctor = req.body;
      const result = await doctorsCollection.insertOne(doctor);
      res.send(result);
    });

    //----------------- get  doctors a  API------------------------


    app.get('/doctors', verifyJWT, verifyAdmin, async (req, res) => {
      const query = {};
      const doctors = await doctorsCollection.find(query).toArray();
      res.send(doctors);
    })

    //----------------- delete doctors a  API------------------------

    app.delete('/doctors/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await doctorsCollection.deleteOne(filter);
      res.send(result);
    })


  } finally {
  }
}
run().catch(console.log);

app.get("/", async (req, res) => {
  res.send("doctors portal server is running");
});

app.listen(port, () => console.log(`Doctors portal running on ${port}`));
