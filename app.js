const express = require('express')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const axios = require('axios')

const app = express()
app.use(express.json())

let dbPath = path.join(__dirname, 'users.db')
let db = null

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log(`Server Running at http://localhost:3000/`)
    })
  } catch (error) {
    console.log(`DB Error: ${error.message}`)
    process.exit(1)
  }
}
initializeDbAndServer()

//Task 1
//API: Register New User
app.post('/register/', async (request, response) => {
  const userDetails = request.body
  const {username, email, password} = userDetails
  const addBookQuery = `
    INSERT INTO
      user (username,
    email,
    password)
    VALUES
      (
        '${username}',
         ${email},
         ${password},
      );`

  const dbResponse = await db.run(addBookQuery)
  const bookId = dbResponse.lastID
  response.send({user: bookId})
})
//API: Login User
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const payLoad = {username}
  const jwtToken = jwt.sign(payLoad, 'SECRET_KEY')
  const userCheckQuery = `
    SELECT * FROM user WHERE username = '${username}';`
  const dbUser = await db.get(userCheckQuery)
  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatches = await bcrypt.compare(password, dbUser.password)
    if (isPasswordMatches) {
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'SECRET_KEY', async (error, payLoad) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.headers.username = payLoad.username
        next()
      }
    })
  }
}

app.delete('/logout/', authenticateToken, async (request, response) => {
  const {username} = request.headers
  const getUserQuery = `
    SELECT * FROM user WHERE username = '${username}';`
  const dbUser = await db.get(getUserQuery)
  const userId = dbUser['username']

  const userTweetsQuery = `
    SELECT username 
    FROM users
    WHERE username = ${userId};`
  const userTweetsData = await db.all(userTweetsQuery)

  let isUsers = false
  userData.forEach(each => {
    if (each['username'] == username) {
      isUsers = true
    }
  })

  if (isUsers) {
    const query = `
        DELETE FROM users
        WHERE username = ${username};`
    await db.run(query)
    response.send('user Removed')
  } else {
    response.status(401)
    response.send('Invalid Request')
  }
})

//Task 2

// Route for fetching data with optional query parameters
app.get('/api/data', async (req, res) => {
  try {
    // Fetch data from the public API
    const response = await axios.get('https://api.publicapis.org/entries')

    // Extracting the data from the response
    const data = response.data

    // Filtering based on query parameters
    const {category, limit} = req.query
    let filteredData = data.entries

    if (category) {
      filteredData = filteredData.filter(entry => entry.Category === category)
    }

    if (limit) {
      filteredData = filteredData.slice(0, parseInt(limit, 10))
    }

    // Sending the filtered data as the response
    res.json(filteredData)
  } catch (error) {
    // Handling errors
    console.error('Error fetching data:', error)
    res.status(500).json({error: 'Internal Server Error'})
  }
})

// Starting the server
app.listen(3000, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})

//task 4
app.post('/auth/', async (request, response) => {
  const {username, email, password} = request.body

  const userCheckQuery = `
    SELECT * FROM user WHERE username = '${username}';`
  const dbUser = await db.get(userCheckQuery)
  if (dbUser === undefined) {
    if (password.length < 6) {
      response.status(400)
      response.send('Password is too short')
    } else {
      const hashPassword = await bcrypt.hash(password, 10)
      const registerUserQuery = `
            INSERT INTO 
                users(username,email,password)
            VALUES
                ('${username}', '${hashPassword}',${email});`
      await db.run(registerUserQuery)
      response.send('User created successfully')
    }
  } else {
    response.status(400)
    response.send('User already exists')
  }
})
module.exports = app
