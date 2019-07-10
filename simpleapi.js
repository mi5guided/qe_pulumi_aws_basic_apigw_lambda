// ****************************************************************************
// Module: simple lambda function with API Gateway method front end
//   Resources created:
//   - role
//   - lambda
//   - etc
// ****************************************************************************

"use strict";
const aws = require("@pulumi/aws");
const pulumi = require("@pulumi/pulumi");

// Default module values
let modConfig = {
  "prefix": "prefix",
  "suffix": "aaaa"
};
let rsrcPulumiSimpleApi = {};

// ****************************************************************************
// Configure module
// ****************************************************************************
function setModuleConfig(parm) {
  let valList = Object.keys(parm);
  valList.forEach((x) => {
    modConfig[x] = parm[x];
  });

  // grab the configured deployment region
  modConfig.region = new pulumi.Config("aws").require("region");
}

// ****************************************************************************
// Create resources
// ****************************************************************************
function rsrcPulumiCreate() {
  // Create the Lambda function first
  rsrcPulumiSimpleApi.lambdaRole = new aws.iam.Role(modConfig.prefix + "LambdaRole", {
    name: modConfig.prefix + "LambdaRole",
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({ Service: "lambda.amazonaws.com" }),
  });

  rsrcPulumiSimpleApi.lambdaRolePolicy = new aws.iam.RolePolicy(modConfig.prefix + "LambdaRolePolicy", {
    role: rsrcPulumiSimpleApi.lambdaRole.id,
    policy: pulumi.output({
      Version: "2012-10-17",
      Statement: [{
        Action: ["logs:*", "cloudwatch:*"],
        Resource: "*",
        Effect: "Allow",
      }],
    }),
  });

  rsrcPulumiSimpleApi.lambda = new aws.lambda.Function(modConfig.prefix + "LambdaFunc", {
    runtime: aws.lambda.NodeJS10dXRuntime,
    name: modConfig.prefix + "LambdaFunc",
    code: new pulumi.asset.AssetArchive({
      ".": new pulumi.asset.FileArchive("./simplelambda.zip"),
    }),
    timeout: 300,
    handler: "simplelambda.handler",
    role: rsrcPulumiSimpleApi.lambdaRole.arn
  }, { dependsOn: [rsrcPulumiSimpleApi.lambdaRolePolicy] });

  // Create the API Gateway Rest API
  rsrcPulumiSimpleApi.apiRestApi = new aws.apigateway.RestApi(modConfig.prefix + "basicApi", {
    name: modConfig.prefix + "BasicApi",
    description: "A simple lambda integration",
    endpointConfiguration: { types: "REGIONAL" }
  });

  rsrcPulumiSimpleApi.apiCart = new aws.apigateway.Resource(modConfig.prefix + "basicApiCart", {
    parentId: rsrcPulumiSimpleApi.apiRestApi.rootResourceId,
    pathPart: "iface",
    restApi: rsrcPulumiSimpleApi.apiRestApi.id
  });

  rsrcPulumiSimpleApi.apiMethod = new aws.apigateway.Method(modConfig.prefix + "basicApiMethod", {
    apiKeyRequired: false,
    authorization: "NONE",
    httpMethod: "GET",
    requestParameters: {},
    requestModels: { "application/json": modConfig.prefix + "basicApiModel" },
    resourceId: rsrcPulumiSimpleApi.apiCart.id,
    restApi: rsrcPulumiSimpleApi.apiRestApi.id
  }), { dependsOn: [rsrcPulumiSimpleApi.apiModel] };

  rsrcPulumiSimpleApi.apiModel = new aws.apigateway.Model(modConfig.prefix + "basicApiModel", {
    contentType: "application/json",
    description: "a JSON schema",
    restApi: rsrcPulumiSimpleApi.apiRestApi.id,
    name: modConfig.prefix + "basicApiModel",
    schema: '{}'
  });

  rsrcPulumiSimpleApi.apiRestIntegration = new aws.apigateway.Integration(modConfig.prefix + "basicApiIntegration", {
    httpMethod: rsrcPulumiSimpleApi.apiMethod.httpMethod,
    integrationHttpMethod: "POST",
    resourceId: rsrcPulumiSimpleApi.apiCart.id,
    restApi: rsrcPulumiSimpleApi.apiRestApi.id,
    type: "AWS",
    passthroughBehavior: "WHEN_NO_MATCH",
    // requestTemplates: modConfig.requestTemplate,
    uri: pulumi.interpolate`arn:aws:apigateway:${modConfig.region}:lambda:path/2015-03-31/functions/${rsrcPulumiSimpleApi.lambda.arn}/invocations`
  }, { dependsOn: [rsrcPulumiSimpleApi.lambda] });

  rsrcPulumiSimpleApi.apiIntegrationResponse = new aws.apigateway.IntegrationResponse(modConfig.prefix + "basicApiIntegrationResponse", {
    httpMethod: rsrcPulumiSimpleApi.apiMethod.httpMethod,
    resourceId: rsrcPulumiSimpleApi.apiCart.id,
    restApi: rsrcPulumiSimpleApi.apiRestApi.id,
    statusCode: "200"
  }, { dependsOn: [rsrcPulumiSimpleApi.apiRestIntegration] });

  rsrcPulumiSimpleApi.apiMethodResponse = new aws.apigateway.MethodResponse("200", {
    httpMethod: rsrcPulumiSimpleApi.apiMethod.httpMethod,
    resourceId: rsrcPulumiSimpleApi.apiCart.id,
    restApi: rsrcPulumiSimpleApi.apiRestApi.id,
    statusCode: "200"
  });

  rsrcPulumiSimpleApi.apiDeployment = new aws.apigateway.Deployment(modConfig.prefix + "basicApiDeployment", {
    restApi: rsrcPulumiSimpleApi.apiRestApi,
    // Note: Set to empty to avoid creating an implicit stage, we'll create it explicitly below instead.
    stageName: ""
  }, { dependsOn: [rsrcPulumiSimpleApi.apiMethod, rsrcPulumiSimpleApi.apiRestIntegration] });

  rsrcPulumiSimpleApi.apiStage = new aws.apigateway.Stage(modConfig.prefix + "basicApiStage", {
    restApi: rsrcPulumiSimpleApi.apiRestApi,
    deployment: rsrcPulumiSimpleApi.apiDeployment,
    httpMethod: "*",
    resourcePath: "/*",
    stageName: "Prod"
  }, { dependsOn: [rsrcPulumiSimpleApi.apiDeployment] });

  // finally, allow API Gateway to call the lambda function
  rsrcPulumiSimpleApi.apiRestLambdaPermission = new aws.lambda.Permission(modConfig.prefix + "basicLambdaPermissions", {
    action: "lambda:invokeFunction",
    function: rsrcPulumiSimpleApi.lambda,
    principal: "apigateway.amazonaws.com",
    sourceArn: pulumi.interpolate `${rsrcPulumiSimpleApi.apiDeployment.executionArn}*/*`
  }, { dependsOn: [rsrcPulumiSimpleApi.apiDeployment] });
}

// ****************************************************************************
// Custom output
// ****************************************************************************
function postDeploy() {
  pulumi.all([
    rsrcPulumiSimpleApi.apiRestApi.executionArn
  ]).apply(([x]) => {
    console.log("Call RESTT API @:", x);
  });
}

// ****************************************************************************
// API into this module
// ****************************************************************************
function ddStart(params) {
  setModuleConfig(params);
  rsrcPulumiCreate();
  postDeploy();
}

module.exports.ddStart = ddStart;
module.exports.pulumiResources = rsrcPulumiSimpleApi;
