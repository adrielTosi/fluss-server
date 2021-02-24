import {
  Mutation,
  Arg,
  Resolver,
  InputType,
  Field,
  Ctx,
  ObjectType,
  Query,
  FieldResolver,
  Root,
} from "type-graphql";
import argon2 from "argon2";
import { v4 as uuid } from "uuid";

import { User } from "../entities/User";
import { Profile } from "../entities/Profile";
import { MyContext } from "../types";
import { COOKIE_NAME, FORGOT_PASSWORD_PREFIX } from "../constants";
import { sendEmail } from "../utils/sendEmail";
import { getConnection, getRepository } from "typeorm";
import { AuthenticationError, UserInputError } from "apollo-server-express";
import {
  FlussUserInputError,
  UserInputErrorCode,
  UserInputOperation,
} from "../utils/validation/FlussUserInputError";

@InputType()
class UsernamePasswordInput {
  @Field()
  email: string;
  @Field()
  username: string;
  @Field()
  password: string;
}

@ObjectType()
class FieldError {
  @Field()
  field: string;

  @Field()
  message: string;
}

/**
 * @UserResponse
 * It will have either `errors` or `user` field.
 */
@ObjectType()
class UserResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];

  @Field(() => User, { nullable: true })
  user?: User;
}

@Resolver(User)
export class UserResolver {
  @FieldResolver(() => String)
  email(@Root() user: User, @Ctx() { req }: MyContext) {
    // ? What is exactly this Root? And how does it know the user?
    // Current user can see their own email
    if (req.session.userId === user.id) {
      return user.email;
    }
    // Any other email returns empty string
    return "";
  }

  /**
   *
   * @AllUsers
   */
  @Query(() => [User])
  async users(): Promise<User[]> {
    const users = await getRepository(User).find({
      relations: ["profile", "profile.planetOfOrigin"],
    });
    return users;
    // const users = await getConnection().query(`
    //   select u.*,
    //   json_build_object(
    //     'id', p.id,
    //     'createdAt', p."createdAt",
    //     'updatedAt', p."updatedAt",
    //     'planetOfOrigin', json_build_object(
    //         'id', pl.id,
    //         'name', pl.name,
    //         'size', pl.size,
    //         'createdAt', pl."createdAt",
    //         'updatedAt', pl."updatedAt"
    //       )
    //     ) as profile
    //   from public.user u
    //   join profile p on u."profileId" = p."id"
    //   left join planet pl on p."planetOfOriginId" = pl."id"
    //   `);
  }

  /**
   * @CurrentUser
   */
  @Query(() => User, { nullable: true })
  async currentUser(@Ctx() { req }: MyContext): Promise<User | undefined> {
    if (!req.session.userId) {
      throw new AuthenticationError("Not authenticated.");
    }

    const user = await User.findOne(req.session.userId);

    if (!user) {
      throw new UserInputError("Invalid user.");
    }

    return user;
  }
  /**
   * @Register
   * @param options UserNamePasswordInput
   */
  @Mutation(() => UserResponse)
  async register(
    @Arg("options") options: UsernamePasswordInput,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse | undefined> {
    const foundUserByEmail = await User.findOne({
      where: { email: options.email },
    });
    const foundUserByUsername = await User.findOne({
      where: { username: options.username },
    });

    // TODO: Create unique errors for these using `ApolloError()`
    // https://www.apollographql.com/docs/apollo-server/data/errors/#other-errors
    // Add validation for email -> add actual validation library
    if (foundUserByEmail) {
      throw new FlussUserInputError("This email is already taken.", {
        operation: UserInputOperation.register,
        flussError: UserInputErrorCode.EmailExists,
      });
    }
    if (foundUserByUsername) {
      throw new FlussUserInputError("This username already exists.", {
        operation: UserInputOperation.register,
        flussError: UserInputErrorCode.UsernameExists,
      });
    }

    if (options.username.length < 3) {
      throw new FlussUserInputError("Username must be longer than 2 letters.", {
        operation: UserInputOperation.register,
        flussError: UserInputErrorCode.UsernameTooShort,
      });
    }
    if (options.password.length < 3) {
      throw new FlussUserInputError(
        "Password must be longer than 2 characters.",
        {
          operation: UserInputOperation.register,
          flussError: UserInputErrorCode.PasswordTooShort,
        }
      );
    }

    // Has the password to store
    const hashedPassword = await argon2.hash(options.password);

    let user: any = null;
    try {
      await getConnection().transaction(async (tem) => {
        // Transaction Entity Manager
        const qb = await tem.createQueryBuilder();
        const newProfile = await qb
          .insert()
          .into(Profile)
          .values({ planetOfOrigin: 1 })
          .returning("*")
          .execute();

        const userInsert = await qb
          .insert()
          .into(User)
          .values({
            username: options.username,
            email: options.email,
            password: hashedPassword,
            profile: newProfile.raw[0],
          })
          .returning("*")
          .execute();

        user = userInsert.raw[0]; // The `raw` key is because we used "returnin('*')"
      });
    } catch (err) {
      console.log("Error: ", err);
    }

    // Automatially log in user after registering.
    req.session.userId = user.id;

    return { user };
  }

  /**
   * @Login
   * @param options UserNamePasswordInput
   */
  @Mutation(() => UserResponse, { nullable: true })
  async login(
    @Arg("usernameOrEmail") usernameOrEmail: string,
    @Arg("password") password: string,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    // Try finding an user based on the username
    const isEmail = usernameOrEmail.includes("@");
    const user = await User.findOne({
      where: isEmail
        ? { email: usernameOrEmail }
        : { username: usernameOrEmail },
    });

    // todo: Add validation library
    // If there is no user, return new UserResponse object
    // with errors(type FieldError[]) and no user(type User)
    if (!user) {
      throw new FlussUserInputError("Username or email doesn't exists.", {
        operation: UserInputOperation.login,
        flussError: UserInputErrorCode.InvalidEmailOrUsername,
      });
    }

    // Same thing but with invalid password
    const valid = await argon2.verify(user.password, password);
    if (!valid) {
      throw new FlussUserInputError("Password is incorrect.", {
        operation: UserInputOperation.login,
        flussError: UserInputErrorCode.InvalidPassword,
      });
    }

    req.session.userId = user.id;

    // If user exist and password is valid, return UserResponse object
    // with user(type User) and no errors(type FieldError[])
    return {
      user,
    };
  }

  @Mutation(() => Boolean)
  async logout(@Ctx() { req, res }: MyContext) {
    return new Promise((resolve) =>
      req.session.destroy((err) => {
        // ? Should the cookie be deleted even if the session was not destroyed. If yes, should be move to below the if statement
        res.clearCookie(COOKIE_NAME);

        if (err) {
          console.log(err);
          resolve(false);
        }

        resolve(true);
      })
    );
  }

  @Mutation(() => Boolean)
  async forgotPassword(
    @Arg("email") email: string,
    @Ctx() { redis }: MyContext
  ) {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      // email not in the database
      return false;
    }

    const token = uuid();
    const key = FORGOT_PASSWORD_PREFIX + token;
    await redis.set(key, user.id, "ex", 60 * 60 * 24); // one day

    const content = `<a href="http://localhost:3000/change-password/${token}"></>`;
    await sendEmail(user.email, content);

    return true;
  }

  @Mutation(() => UserResponse)
  async changePassword(
    @Arg("token") token: string,
    @Arg("newPassword") newPassword: string,
    @Ctx() { redis, req }: MyContext
  ): Promise<UserResponse> {
    if (newPassword.length < 3) {
      throw new FlussUserInputError(
        "Password must be longer than 2 characters.",
        {
          operation: UserInputOperation.register,
          flussError: UserInputErrorCode.PasswordTooShort,
        }
      );
    }

    const key = FORGOT_PASSWORD_PREFIX + token;
    const userId = await redis.get(key);

    if (!userId) {
      throw new FlussUserInputError(
        "Token is invalid or expired, please try again.",
        {
          operation: UserInputOperation.changePassword,
          flussError: UserInputErrorCode.InvalidUser,
        }
      );
    }
    const intId = parseInt(userId);
    const user = await User.findOne({ id: intId });

    if (!user) {
      throw new FlussUserInputError("User no longer exists.", {
        operation: UserInputOperation.changePassword,
        flussError: UserInputErrorCode.InvalidUser,
      });
    }

    const hash = await argon2.hash(newPassword);
    await User.update({ id: intId }, { password: hash });
    await redis.del(key);
    // automatically login user with
    req.session.userId = user.id;

    return { user };
  }

  @Mutation(() => UserResponse)
  async changeUsername(
    @Arg("newUsername") newUsername: string,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    const user = await User.findOne({ id: req.session.userId });
    if (!user) {
      throw new FlussUserInputError("Something went wrong, please try again.", {
        operation: UserInputOperation.changePassword,
        flussError: UserInputErrorCode.InvalidUser,
      });
    }

    const isTaken = await User.findOne({ where: { username: newUsername } });

    if (isTaken) {
      throw new FlussUserInputError("This username already exists.", {
        operation: UserInputOperation.register,
        flussError: UserInputErrorCode.UsernameExists,
      });
    }

    user.username = newUsername;
    await user.save();

    return { user };
  }
}
