const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("./model/userModel");
const Post = require("./model/postModel");
const mongoose = require("mongoose");
const multer = require("multer");
const fs = require("fs");
const { isatty } = require("tty");

const app = express();

// middlewares
app.use(cors({ credentials: true, origin: "http://localhost:5000" }));
app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(__dirname + "/uploads"));
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + "_" + Date.now());
  },
});
const upload = multer({ storage: storage });

const secret = "anvadf215af4df94vba98v46a1v9a8df9a9d8gfa8gv9a4v";

// home test
app.get("/", (req, res) => {
  res.json({ success: "hi there" });
});

// Signup post route
app.post("/signup", upload.single("avatar"), async (req, res) => {
  const { originalname, path } = req.file;
  const { userName, email, password } = req.body;
  try {
    // creating a valid file path
    const oArr = originalname.split(".");
    const ext = oArr[oArr.length - 1];
    const newPath = path + "." + ext;
    fs.renameSync(path, newPath);

    // Check for any empty fields
    if (!userName || !email) {
      return res.json("Fill all the fields");
    }

    // check for password length
    if (!password || password.length < 8) {
      return res.json("Password too short");
    }

    // hash the password after validation
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password.toString(), salt);
    if (hashedPassword) {
      console.log("Password hashing successfull");
    }

    // create the user after validation
    const newUser = await User.create({
      userName,
      email,
      password: hashedPassword,
      avatar: newPath,
    });
    if (newUser) {
      console.log("New user is created");
    }
    res.status(224).json(newUser);
  } catch (err) {
    if (err.code === 11000) {
      return res.json("Email already in use");
    }
    res.status(400).json(err);
  }
});

// Login post route
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    // Check for any empty fields
    if (!email) {
      return res.json("Fill all the fields");
    }

    // check for password length
    if (!password || password.length < 8) {
      return res.json("Password too short");
    }

    // find user by email
    const foundUser = await User.findOne({ email });
    if (foundUser) {
      console.log("user found");
    }

    // compare the password with user entered pass and DB pass
    const isMatch = await bcrypt.compare(password, foundUser.password);

    // ig password is matched then the user is logged in
    if (isMatch) {
      // jenerate a token for logged in user
      const loggedUser = jwt.sign(
        {
          id: foundUser._id,
          userName: foundUser.userName,
          email,
          avatar: foundUser.avatar,
        },
        secret,
        { expiresIn: "1h" }
      );

      // check if the token is generated or not
      if (!loggedUser) {
        return res.json("token generate issue");
      }

      res
        .cookie("loggedUser", loggedUser)
        .status(224)
        .json({ id: foundUser._id, userName: foundUser.userName, email });
    }

    // if password is not matched
    if (!isMatch) {
      console.log("wrong password");
      return res.json("password wrong");
    }
  } catch (error) {
    res.status(400).json(error);
    console.log(error);
  }
});

// Get profile
app.get("/profile", (req, res) => {
  const { loggedUser } = req.cookies;
  try {
    if (loggedUser) {
      const verifyUser = jwt.verify(loggedUser, secret);

      // check if the token is verified or not
      if (!verifyUser) {
        return res.json("token not verified");
      }

      res.status(224).json(verifyUser);
    }

    if (!loggedUser) {
      return res.json("unable to fetch token");
    }
  } catch (error) {
    res.json(error);
  }
});

// Logout post route
app.post("/logout", (req, res) => {
  try {
    res.clearCookie("loggedUser").status(224).josn("User Logout Succesfully");
  } catch (error) {
    res.json(error);
  }
});

// create post route
app.post("/create_post", upload.single("cover"), async (req, res) => {
  const { originalname, path } = req.file;
  const { title, summary, content } = req.body;
  const { loggedUser } = req.cookies;

  try {
    // creating a valid file path
    const oArr = originalname.split(".");
    const ext = oArr[oArr.length - 1];
    const newPath = path + "." + ext;
    fs.renameSync(path, newPath);

    if (loggedUser) {
      const verifyUser = jwt.verify(loggedUser, secret);

      // check if the token is verified or not
      if (!verifyUser) {
        return res.json("token not verified");
      }

      // creating a new post
      const newPost = await Post.create({
        title,
        summary,
        content,
        cover: newPath,
        author: verifyUser.id,
      });

      if (newPost) {
        console.log("New post created");
      }
      res.status(224).json(newPost);
    }

    if (!loggedUser) {
      return res.json("unable to fetch token");
    }
  } catch (error) {
    res.json(error);
  }
});

app.get("/posts", async (req, res) => {
  try {
    const posts = await Post.find()
      .populate("author", ["userName", "avatar"])
      .sort({ createdAt: -1 });

    if (posts) {
      console.log("Got all the posts from database");
    }

    res.status(224).json(posts);
  } catch (error) {
    res.json(error);
  }
});

app.get("/single_post/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const post = await Post.findById(id).populate("author", [
      "userName",
      "avatar",
    ]);
    res.status(224).json(post);
  } catch (error) {
    res.json(error);
  }
});

app.put("/post/edit/:id", upload.single("cover"), async (req, res) => {
  const { id } = req.params;
  const { loggedUser } = req.cookies;
  const { title, summary, content } = req.body;
  let newPath = null;
  try {
    if (req.file) {
      const { originalname, path } = req.file;
      // creating a valid file path
      const oArr = originalname.split(".");
      const ext = oArr[oArr.length - 1];
      const newPath = path + "." + ext;
      fs.renameSync(path, newPath);
    }

    if (loggedUser) {
      const verifyUser = jwt.verify(loggedUser, secret);

      // check if the token is verified or not
      if (!verifyUser) {
        return res.json("token not verified");
      }

      const postDoc = await Post.findById(id);
      const isAuthor =
        JSON.stringify(postDoc.author) === JSON.stringify(verifyUser.id);
      console.log("isAuthor=>", isAuthor);

      if (!isAuthor) {
        res.json("You are not the author");
      }

      if (isAuthor) {
        const newPostDoc = await Post.findByIdAndUpdate(
          id,
          {
            title,
            summary,
            content,
            cover: newPath ? newPath : postDoc.cover,
          },
          { new: true }
        );

        if (newPostDoc) {
          console.log("Post updated success");
        }
        res.status(224).json(newPostDoc);
      }
    }
  } catch (error) {
    res.json(error);
  }
});

app.delete("/post/delete/:id", async (req, res) => {
  const { id } = req.params;
  console.log(id);
  const { loggedUser } = req.cookies;

  try {
    if (loggedUser) {
      const verifyUser = jwt.verify(loggedUser, secret);
      console.log(verifyUser);
      // check if the token is verified or not
      if (!verifyUser) {
        return res.json("token not verified");
      }

      const postDoc = await Post.findById(id);
      console.log(postDoc);
      const isAuthor =
        JSON.stringify(verifyUser.id) === JSON.stringify(postDoc.author);
      console.log(isAuthor);

      if (isAuthor) {
        const removedPostDoc = await Post.findByIdAndDelete(id);

        if (removedPostDoc) {
          console.log("Post deletion success");
        }
        res.status(224).json(removedPostDoc);
      }
    }
  } catch (error) {
    res.json(error);
  }
});

// mongoose connection string
mongoose
  .connect(
    "mongodb+srv://merndev0:CixwZFZV3ixDwTHD@cluster0.lqrakef.mongodb.net/?retryWrites=true&w=majority",
    { useNewUrlParser: true, useUnifiedTopology: true }
  )
  .then(() => {
    console.log("mongoose connection established");
    app.listen(8080, () => {
      console.log("server is live on port 8080");
    });
  })
  .catch((error) => {
    console.error("connection error", error);
  });
