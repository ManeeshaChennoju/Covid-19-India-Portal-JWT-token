const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;
// ................  Function calls .......................//

const convertStateDetails = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convertDistrictDetails = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};
// ................  Function calls .......................//

// ................  Middleware Functions .......................//

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "Secret_Token", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

// ................  Middleware Functions .......................//

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3001, () => {
      console.log("Server running at http://localhost:3001/");
    });
  } catch (e) {
    console.log(`DB Error : ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

// API 1 --- Path: `/login/` --- Method: `POST`

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(getUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const passwordMatched = await bcrypt.compare(password, dbUser.password);
    if (passwordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "Secret_Token");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// API 2 --- Path: `/states/` --- Method: `GET`

app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `SELECT * FROM state ORDER BY state_id;`;
  const states = await db.all(getStatesQuery);
  const statesArray = states.map(convertStateDetails);
  response.send(statesArray);
});

// API 3 --- Path: `/states/:stateId/` --- Method: `GET`

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `SELECT * FROM state WHERE state_id = ${stateId};`;
  const state = await db.get(getStateQuery);
  response.send(convertStateDetails(state));
});

// API 4 --- Path: `/districts/` --- Method: `POST`

app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const addDistrictQuery = `INSERT INTO district
                            (district_name, state_id,cases,cured, active, deaths)
                            VALUES (
                                '${districtName}',
                                '${stateId}',
                                '${cases}',
                                '${cured}',
                                '${active}',
                                '${deaths}'
                            );`;
  const dbResponse = await db.run(addDistrictQuery);
  response.send("District Successfully Added");
});

// API 5 --- Path: `/districts/:districtId/` --- Method: `GET`

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `SELECT * FROM district WHERE district_id = ${districtId};`;
    const district = await db.get(getDistrictQuery);
    response.send(convertDistrictDetails(district));
  }
);

// API 6 --- Path: `/districts/:districtId/` --- Method: `DELETE`

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQry = `DELETE FROM district WHERE district_id = ${districtId};`;
    const dbResponse = await db.get(deleteDistrictQry);
    response.send("District Removed");
  }
);

// API 7 --- Path: `/districts/:districtId/` --- Method: `PUT`

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictQuery = `UPDATE district
                                SET 
                                district_name = '${districtName}',
                                state_id = '${stateId}',
                                cases= '${cases}',
                                cured = '${cured}',
                                active = '${active}',
                                deaths = '${deaths}'
                                WHERE district_id = ${districtId};`;
    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

// API 8 --- Path: `/states/:stateId/stats/` --- Method: `GET`
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatisticsQuery = `SELECT SUM(cases) as totalCases,
                                       SUM(cured) as totalCured,
                                       SUM(active) as totalActive,
                                       SUM(deaths) as totalDeaths
                                FROM district WHERE state_id = ${stateId};`;
    const statistics = await db.get(getStatisticsQuery);
    response.send(statistics);
  }
);

module.exports = app;
