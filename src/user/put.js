import url from 'url';
import { Users } from 'gitlab';

async function putGitlabUser(body, context, callback) {
  const {
    name,
    password,
  } = JSON.parse(body);

  const users = new Users({
    url:   process.env.gitlabUrl,
    token: password
  });

  try {
    const user = await users.current();

    if (user.username !== name) {
      throw "Unauthorized";
    }

    return callback(null, {
      statusCode: 201,
      body: JSON.stringify({
        ok: true,
        token: password,
      }),
    });
  } catch (error) {
    return callback(null, {
      statusCode: 403,
      body: JSON.stringify({
        ok: false,
        error: error.message,
      }),
    });
  }
}

export default async ({ body }, context, callback) => putGitlabUser(body, context, callback);