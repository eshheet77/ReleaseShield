
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { execFile } = require("child_process");
const { promisify } = require("util");
require("dotenv").config();

const app = express();
const execFileAsync = promisify(execFile);

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

const PORT = process.env.PORT || 5000;
const JENKINS_URL = process.env.JENKINS_URL || "http://localhost:8081";
const APP_URL = process.env.APP_URL || "http://localhost:8083";
const JENKINS_JOB = "ReleaseShield-Pipeline";

const JENKINS_AUTH = {
  username: process.env.JENKINS_USER,
  password: process.env.JENKINS_API_TOKEN
};

const JENKINS_CONFIG = {
  auth: JENKINS_AUTH,
  timeout: 10000
};

async function dockerCommand(args) {
  const { stdout } = await execFileAsync("docker", args, {
    timeout: 10000
  });
  return stdout.trim();
}

// Backend health
app.get("/api/health", (req, res) => {
  res.json({
    status: "UP",
    service: "ReleaseShield Backend"
  });
});

// Infrastructure status
app.get("/api/status", async (req, res) => {
  const results = await Promise.allSettled([
    dockerCommand(["ps", "-a", "--format", "{{json .}}"]),
    axios.get(`${APP_URL}/actuator/health`, { timeout: 5000 }),
    axios.get(`${JENKINS_URL}/api/json`, JENKINS_CONFIG),
    dockerCommand([
      "exec",
      "releaseshield-nginx",
      "cat",
      "/etc/nginx/conf.d/default.conf"
    ])
  ]);

  let containers = [];
  let appHealth = "UNKNOWN";
  let jenkinsStatus = "UNKNOWN";
  let activeEnvironment = "UNKNOWN";
  let nginxConfig = "";

  if (results[0].status === "fulfilled") {
    containers = results[0].value
      .split("\n")
      .filter(Boolean)
      .map(line => JSON.parse(line))
      .filter(container =>
        [
          "releaseshield-blue",
          "releaseshield-green",
          "releaseshield-nginx",
          "releaseshield-jenkins"
        ].includes(container.Names)
      );
  }

  if (results[1].status === "fulfilled") {
    appHealth = results[1].value.data.status || "UNKNOWN";
  }

  if (results[2].status === "fulfilled") {
    jenkinsStatus = "CONNECTED";
  }

  if (results[3].status === "fulfilled") {
    nginxConfig = results[3].value;

    const match = nginxConfig.match(
      /server\s+releaseshield-(blue|green):8080/
    );

    if (match) {
      activeEnvironment = match[1].toUpperCase();
    }
  }

  res.json({
    docker: results[0].status === "fulfilled"
      ? "CONNECTED" : "DISCONNECTED",
    containers,
    application: appHealth,
    jenkins: jenkinsStatus,
    nginx: results[3].status === "fulfilled"
      ? "CONNECTED" : "DISCONNECTED",
    activeEnvironment,
    nginxConfig
  });
});

// Jenkins job information
app.get("/api/jenkins", async (req, res) => {
  try {
    const response = await axios.get(
      `${JENKINS_URL}/api/json`,
      {
        ...JENKINS_CONFIG,
        params: {
          tree: "jobs[name,color,lastBuild[number,result,timestamp,duration]]"
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    res.status(503).json({
      error: "Unable to retrieve Jenkins information",
      details: error.response?.status
        ? `Jenkins returned HTTP ${error.response.status}`
        : error.message
    });
  }
});

// Trigger the actual Jenkins pipeline
app.post("/api/jenkins/build", async (req, res) => {
  try {
    const jobUrl =
      `${JENKINS_URL}/job/${encodeURIComponent(JENKINS_JOB)}`;

    // Retrieve Jenkins CSRF crumb
    const crumbResponse = await axios.get(
      `${JENKINS_URL}/crumbIssuer/api/json`,
      JENKINS_CONFIG
    );

    const crumb = crumbResponse.data;

    // Trigger build with Jenkins authentication and CSRF protection
    const buildResponse = await axios.post(
      `${jobUrl}/build`,
      null,
      {
        ...JENKINS_CONFIG,
        headers: {
          [crumb.crumbRequestField]: crumb.crumb
        },
        maxRedirects: 0,
        validateStatus: status => status >= 200 && status < 400
      }
    );

    res.status(202).json({
      message: "Jenkins build request accepted",
      job: JENKINS_JOB,
      queueUrl: buildResponse.headers.location || null
    });
  } catch (error) {
    const status = error.response?.status || 500;

    res.status(status).json({
      error: "Unable to trigger Jenkins build",
      details: error.response?.data || error.message
    });
  }
});

app.listen(PORT, () => {
  console.log("-----------------------------------");
  console.log(" ReleaseShield Backend Started");
  console.log(` http://localhost:${PORT}`);
  console.log("-----------------------------------");
});
