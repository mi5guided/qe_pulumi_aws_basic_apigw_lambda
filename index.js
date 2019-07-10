// ****************************************************************************
// Main Entry Point for this Pulumi Project
//   Segemented out 1 module, the basic lambda function fronted by API Gateway
// ****************************************************************************

"use strict";
const simpleApi = require("./simpleapi");

// Define and Deploy Lambda and API Gateway (override defaults)
var basicLambdaAPI = {
  "prefix": "base",
  "suffix": "-" + (1562717324716 & 0x00FFFF).toString(16)
};
simpleApi.ddStart(basicLambdaAPI);

