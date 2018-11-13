import { Users, Groups } from 'gitlab';

const generatePolicy = ({
  effect,
  methodArn,
  token,
  isAdmin,
}) => {
  const methodParts = methodArn.split(':');
  const region = methodParts[3];
  const accountArn = methodParts[4];
  const apiId = methodParts[5].split('/')[0];
  const stage = methodParts[5].split('/')[1];

  const authResponse = {};
  authResponse.principalId = token;

  const policyDocument = {};
  policyDocument.Version = '2012-10-17';
  policyDocument.Statement = [];

  const statementOne = {};
  statementOne.Action = 'execute-api:Invoke';
  statementOne.Effect = effect;
  statementOne.Resource = `arn:aws:execute-api:${region}:${accountArn}:${apiId}/${stage}/GET/registry*`;
  policyDocument.Statement[0] = statementOne;

  const statementTwo = {};
  statementTwo.Action = 'execute-api:Invoke';
  statementTwo.Effect = isAdmin ? 'Allow' : 'Deny';
  statementTwo.Resource = `arn:aws:execute-api:${region}:${accountArn}:${apiId}/${stage}/PUT/registry*`;
  policyDocument.Statement[1] = statementTwo;

  const statementThree = {};
  statementThree.Action = 'execute-api:Invoke';
  statementThree.Effect = isAdmin ? 'Allow' : 'Deny';
  statementThree.Resource = `arn:aws:execute-api:${region}:${accountArn}:${apiId}/${stage}/DELETE/registry*`;
  policyDocument.Statement[2] = statementThree;

  authResponse.policyDocument = policyDocument;

  return authResponse;
};

export default async ({ methodArn, authorizationToken }, context, callback) => {
  const tokenParts = authorizationToken.split('Bearer ');

  if (tokenParts.length <= 1) {
    return callback(null, generatePolicy({
      token: authorizationToken,
      effect: 'Deny',
      methodArn,
      isAdmin: false,
    }));
  }

  const token = tokenParts[1];

  const users = new Users({
    baseUrl: process.env.gitlabUrl,
    token: token
  });

  try {
    const user = await users.current();

    let isAdmin = false;
    let effect = 'Allow';
    let restrictedOrgs = process.env.restrictedOrgs 
      ? process.env.restrictedOrgs.split(',') : [];

    if (restrictedOrgs.length) {
      try {
        const groups = new Groups({
          baseUrl: process.env.gitlabUrl,
          token: token
        });

        const userGroups = await groups.all();

        const usersOrgs = userGroups.filter(org => restrictedOrgs.indexOf(org.full_path) > -1);
        effect = usersOrgs.length ? 'Allow' : 'Deny';
      } catch (error) {
        return callback(null, generatePolicy({
          token: tokenParts[1],
          effect: 'Deny',
          methodArn,
          isAdmin: false,
        }));
      }
    }

    if (process.env.admins) {
      isAdmin = process.env.admins.split(',').indexOf(user.username) > -1;
    }

    const policy = generatePolicy({
      effect,
      methodArn,
      token,
      isAdmin,
    });

    policy.context = {
      username: user.username,
      avatar: user.avatar_url,
    };

    return callback(null, policy);
  } catch (error) {
    return callback(null, generatePolicy({
      token: tokenParts[1],
      effect: 'Deny',
      methodArn,
      isAdmin: false,
    }));
  }
};
