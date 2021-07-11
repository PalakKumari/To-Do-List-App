require("dotenv").config();
const express = require("express"); //require express
const mongoose = require("mongoose");
const _ = require("lodash");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");

const app = express(); //create an app

app.set("view engine", "ejs"); //use ejs
app.use(express.static("CSS"));
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
mongoose.connect("mongodb://localhost:27017/todolistDB", {
  useNewUrlParser: true,
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
  Item.find(function (err, items) {
    if (err) {
      console.log(err);
    } else {
      if (items.length == 0) {
        Item.insertMany(defaultItems, function (err) {
          if (err) {
            console.log(err);
          } else {
            console.log("items added successfully");
          }
        });
        res.redirect("/list");
      } else {
        res.render("list", { todayDay: "Today", newItems: items });
      }
    }
  });
});

app.post("/list", function (req, res) {
  var listItem = req.body.listItem;
  var listName = req.body.list;
  let item = new Item({
    name: listItem,
  });
  if (listName === "Today") {
    item.save();
    res.redirect("/list");
  } else {
    List.findOne({ name: listName }, function (err, foundList) {
      if (!err) {
        foundList.lists.push(item);
        foundList.save();
        res.redirect("/" + listName);
      }
    });
  }
});
//for deleting items in the home page
app.post("/delete", function (req, res) {
  const checkedItemID = req.body.checkbox;
  const listName = req.body.listName;
  if (listName === "Today") {
    console.log(day);
    Item.findByIdAndRemove(checkedItemID, function (err) {
      if (!err) {
        console.log("deleted");
      }
    });
    res.redirect("/list");
  } else {
    List.findOneAndUpdate(
      { name: listName },
      { $pull: { lists: { _id: checkedItemID } } },
      function (err) {
        if (!err) {
          res.redirect("/" + listName);
        }
      }
    );
  }
});
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
              console.log(user);
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

//get when custom list is requested
app.get("/:listType", function (req, res) {
  const requestedList = _.capitalize(req.params.listType);
  List.findOne({ name: requestedList }, function (err, foundList) {
    if (err) {
      console.log(err);
    } else {
      if (!foundList) {
        //show an existing list
        const list = new List({
          name: requestedList,
          lists: defaultItems,
        });
        list.save();
        res.redirect("/" + requestedList);
      } else {
        //create a new list

        res.render("list", {
          todayDay: foundList.name,
          newItems: foundList.lists,
        });
      }
    }
  });
});

//specifying the port.
app.listen(3000, function () {
  console.log("The server has been started at port 3000");
});
