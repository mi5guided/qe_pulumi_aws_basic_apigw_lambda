var theJsonBody = '{ items: [ {title: "title 1", price: 2.04},{title: "title 2", price: 5.29} ]}';

exports.handler = async (event) => {
  return sendRes(200, theJsonBody);
};

const sendRes = (status, body) => {
  var response = {
    statusCode: status,
    headers: {
      "Content-Type": "application/json"
    },
    body: body
  };
  return response;
};