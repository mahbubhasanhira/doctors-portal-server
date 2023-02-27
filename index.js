const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const MongoClient = require("mongodb").MongoClient;
const admin = require("firebase-admin");
const fileUpload = require("express-fileupload");
const { ObjectID } = require("mongodb");
const app = express();
require("dotenv").config();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(fileUpload());

const connect = {
  DB_USER: process.env.DB_USER,
  DB_PASSWORD: process.env.DB_PASSWORD,
  DB_NAME: process.env.DB_NAME,
  DB_URL_CLUSTER: process.env.DB_URL_CLUSTER,
  FIREBASE_DB_URL: process.env.FIREBASE_DB_URL,
};

const serviceAccount = require("./firebase-adminsdk.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `${connect.FIREBASE_DB_URL}`,
});

const uri = `mongodb+srv://${connect.DB_USER}:${connect.DB_PASSWORD}@${connect?.DB_URL_CLUSTER}/${connect.DB_NAME}?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

client.connect((err) => {
  if (err) {
    console.log("DB connect Error", err);
  }
  console.log("Connect to DB");
  const appointmentCollection = client
    .db(`${connect.DB_NAME}`)
    .collection(`appointment`);
  const doctorsCollection = client
    .db(`${connect.DB_NAME}`)
    .collection(`doctors`);

  const handleTokenEmail = (token) => {
    if (token && token.startsWith("Bearer")) {
      const idToken = token.split(" ")[1];
      // idToken comes from the client app
      return admin
        .auth()
        .verifyIdToken(idToken)
        .then((decodedToken) => decodedToken.email)
        .catch((error) => {
          console.log(error);
          // Handle error
        });
    }
  };

  //get allDoctors from database
  app.get("/getallDoctors", (req, res) => {
    doctorsCollection.find().toArray((error, documents) => {
      res.send(documents);
    });
  });

  //post single appointment data to database
  app.post("/appointment", (req, res) => {
    const appointment = req.body;
    appointmentCollection.insertOne(appointment).then((result) => {
      if (result) {
        res.send(result.insertedCount > 0);
      }
    });
  });

  //get appointmentsByDate  with post method
  app.post("/appointmentsByDate", (req, res) => {
    const date = req.body.convertedToDateString;
    const email = req.body.email;
    const tokenEmail = handleTokenEmail(req.headers.authorization);
    tokenEmail.then((decodeEmail) => {
      if (decodeEmail === email) {
        doctorsCollection
          .find({ email: decodeEmail })
          .toArray((error, result) => {
            if (result.length > 0) {
              appointmentCollection
                .find({ appointmentDate: date })
                .toArray((error, allDocuments) => {
                  res.send(allDocuments);
                });
            }
            if (result.length === 0 || result.length < 0) {
              appointmentCollection
                .find({ appointmentDate: date, email: decodeEmail })
                .toArray((error, documents) => {
                  res.send(documents);
                });
            }
          });
      }
    });
  });

  app.get("/allPatients", (req, res) => {
    const email = req?.query?.email;
    if (email) {
      const tokenEmail = handleTokenEmail(req.headers.authorization);
      tokenEmail.then((decodeEmail) => {
        if (decodeEmail === email) {
          doctorsCollection
            .find({ email: decodeEmail })
            .toArray((error, result) => {
              if (result.length > 0) {
                appointmentCollection.find().toArray((error, documents) => {
                  res.send(documents);
                });
              }
            });
        }
      });
    } else {
      return res.status(400).send("Please Send Token");
    }
  });

  app.post("/addDoctor", (req, res) => {
    const queryEmail = req.query.adminEmail;
    const name = req.body.name;
    const email = req.body.email;
    const phone = req.body.phone;
    const image = req.body.image;

    doctorsCollection
      .find({ email: queryEmail })
      .toArray((error, documents) => {
        if (documents.length > 0) {
          if (name && email && phone && image) {
            doctorsCollection
              .insertOne({ name, email, phone, image })
              .then((result) => {
                res.send(result.insertedCount > 0);
              });
          }
        }
      });
  });

  app.get("/isDoctors", (req, res) => {
    const email = req.query.email;
    doctorsCollection.find({ email: email }).toArray((error, doctors) => {
      res.send(doctors.length > 0);
    });
  });

  app.patch("/updateStatus/:id", (req, res) => {
    const AdminEmail = req.body.adminEmail;
    const tokenEmail = handleTokenEmail(req.headers.authorization);
    tokenEmail.then((decodeEmail) => {
      if (decodeEmail == AdminEmail) {
        doctorsCollection
          .find({ email: decodeEmail })
          .toArray((error, result) => {
            if (result.length > 0) {
              appointmentCollection
                .updateOne(
                  { _id: ObjectID(req.params.id) },
                  { $set: { Status: req.body.status } }
                )
                .then((data) => {
                  if (data.matchedCount > 0) {
                    res.send(data.matchedCount > 0);
                  }
                });
            }
          });
      }
    });
  });
});

app.get("/", (req, res) => {
  res.send("Hello World! Welcome Mahbub Hasan");
});

app.listen(process.env.Port || 4200);
