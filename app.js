require("dotenv").config();
const express = require("express"); //require express
const mongoose = require("mongoose");
const _ = require("lodash");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");

const app = express(); //create an app

app.set("view engine", "ejs"); //use ejs
app.use(express.static("public"));
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);
app.use(express.urlencoded({ extended: true }));
//tell our app to initialize passport
app.use(passport.initialize());
//tell app to use passport for ddealing with sessions.
app.use(passport.session());
//create mongoose connection
mongoose.connect("mongodb+srv://palak:test123@cluster0.2jt75.mongodb.net/todolistDB", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true
});
//creating schema for out collections
const itemsSchema = new mongoose.Schema({
  name: String,
});

//fcreating list schema for custom lists.
const listSchema = new mongoose.Schema({
  name: String,
  lists: [itemsSchema],
});
//creating a user Schema
const userSchema = new mongoose.Schema({
  username: String,
  name: String,
  password: String,
  googleID: String,
  allLists: [listSchema],
  homeList: [itemsSchema],
});
//adding plugins to schema
userSchema.plugin(passportLocalMongoose);

//creating an new model which will create an items collection.
const Item = mongoose.model("Item", itemsSchema);
const List = mongoose.model("list", listSchema);
const User = mongoose.model("user", userSchema);
passport.use(User.createStrategy());
passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(function (id, done) {
  User.findById(id, function (err, user) {
    done(err, user);
  });
});
//creating default items in the array.
const item1 = new Item({
  name: "Welcome to your To-Do list!",
});
const item2 = new Item({
  name: "Click the + button to add a new item.",
});
const item3 = new Item({
  name: "<-- click this to delete an item",
});
//default items array.

const defaultItems = [item1, item2, item3];

//find all the items.
//day variable
var date = new Date();
var options = {
  weekday: "long",
  day: "numeric",
  month: "long",
};
var day = date.toLocaleDateString("en-US", options);
//on getting request to access home page
app.get("/", function (req, res) {
  res.render("home");
});

app.get("/list", function (req, res) {
  if (req.isAuthenticated()) {
    User.findById(req.user.id, function (err, foundUser) {
      if (!err) {
        const items = foundUser.homeList;
        if (items.length == 0) {
          foundUser.homeList.push(item1, item2, item3);
          foundUser.save(function (err) {
            if (err) {
              console.log(err);
            }
          });
        }
        res.render("list", {
          lists: foundUser.allLists,
          thisList: foundUser.homeList,
          listName: "Today",
        });
      }
    });
  } else {
    res.redirect("/login");
  }
});

app.post("/list", function (req, res) {
  var listItem = req.body.listItem;
  var listName = req.body.list;
  let item = new Item({
    name: listItem,
  });
  User.findById(req.user.id, function (err, foundUser) {
    if (!err) {
      if (listName === "Today") {
        foundUser.homeList.push(item);
        foundUser.save(function (err) {
          if (!err) {
            res.redirect("/list");
          }
        });
      } else {
        foundUser.allLists.forEach(function (list) {
          if (list.name === listName) {
            list.lists.push(item);
            foundUser.save(function (err) {
              if (!err) {
                res.redirect("/lists/" + listName);
              }
            });
          }
        });
      }
    }
  });
});

//for deleting items in the home page
app.post("/delete", function (req, res) {
  const checkedItemID = req.body.checkbox;
  const listName = req.body.listName;
  User.findById(req.user.id, function (err, foundUser) {
    if (!err) {
      if (listName === "Today") {
        foundUser.homeList = foundUser.homeList.filter(function (item) {
          return item.id != checkedItemID;
        });
        foundUser.save(function (err) {
          if (!err) {
            res.redirect("/list");
          }
        });
      } else {
        foundUser.allLists.forEach(function (list) {
          if (list.name === listName) {
            list.lists = list.lists.filter(function (item) {
              return item.id != checkedItemID;
            });
          }
        });
        foundUser.save(function (err) {
          if (!err) {
            res.redirect("/lists/" + listName);
          }
        });
      }
    }
  });
});

//     console.log(day);
//     Item.findByIdAndRemove(checkedItemID, function (err) {
//       if (!err) {
//         console.log("deleted");
//       }
//     });
//     res.redirect("/list");
//   } else {
//     List.findOneAndUpdate(
//       { name: listName },
//       { $pull: { lists: { _id: checkedItemID } } },
//       function (err) {
//         if (!err) {
//           res.redirect("/" + listName);
//         }
//       }
//     );
//   }
// });
app.post("/register", function (req, res) {
  const password = req.body.password;
  User.register(
    { username: req.body.username },
    password,
    function (err, user) {
      if (err) {
        console.log(err);
        res.redirect("/register");
      } else {
        passport.authenticate("local")(req, res, function () {
          user.name = req.body.name;
          user.save(function (err) {
            if (!err) {
              // console.log(user);
              //this function will only execute if authentication is successful.
              res.redirect("/list");
            }
          });
        });
      }
    }
  );
});
app.post("/login", function (req, res) {
  const user = new User({
    username: req.body.username,
    password: req.body.password,
  });
  req.login(user, function (err) {
    if (err) {
      res.redirect("/login");
    } else {
      passport.authenticate("local")(req, res, function () {
        res.redirect("/list");
      });
    }
  });
});

app.get("/register", function (req, res) {
  res.render("register");
});
app.get("/login", function (req, res) {
  res.render("login");
});
app.post("/createlist", function (req, res) {
  const newCreatedList = _.capitalize(req.body.createList);
  const newList = new List({
    name: newCreatedList,
  });
  User.findById(req.user.id, function (err, foundUser) {
    if (!err) {
      foundUser.allLists.push(newList);
      foundUser.save(function (err) {
        res.redirect("/list");
      });
    }
  });
});
//get when custom list is requested
app.get("/lists/:listType", function (req, res) {
  const requestedList = _.capitalize(req.params.listType);
  let found = false;
  User.findById(req.user.id, function (err, foundUser) {
    if (!err) {
      foundUser.allLists.forEach(function (list) {
        if (list.name === requestedList) {
          // console.log(list);
          found = true;
          res.render("list", {
            lists: foundUser.allLists,
            thisList: list.lists,
            listName: list.name,
          });
        }
      });
      if (found === false) {
        const newList = new List({
          name: requestedList,
        });
        foundUser.allLists.push(newList);
        foundUser.save(function (err) {
          if (!err) {
            res.render("list", {
              lists: foundUser.allLists,
              thisList: newList.lists,
              listName: newList.name,
            });
          }
        });
      }
    }
  });
});

// List.findOne({ name: requestedList }, function (err, foundList) {
//   if (err) {
//     console.log(err);
//   } else {
//     if (!foundList) {
//       //Create a new list
//       const list = new List({
//         name: requestedList,
//         lists: defaultItems,
//       });
//       list.save();
//       res.redirect("/" + requestedList);
//     } else {
//       //create a new list

//       res.render("list", {
//         todayDay: foundList.name,
//         newItems: foundList.lists,
//       });
//     }
//   }
// });
//specifying the port.
let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}

app.listen(port, function () {
  console.log("The server has been started successfully");
});
