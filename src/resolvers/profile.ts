import isLogged from "../middlewear/isLogged";
import { MyContext } from "../types";
import {
  Arg,
  Ctx,
  Field,
  InputType,
  Mutation,
  Query,
  Resolver,
  UseMiddleware,
} from "type-graphql";
import { Profile } from "../entities/Profile";
import { User } from "../entities/User";
import { Planet } from "../entities/Planet";
import { getConnection } from "typeorm";
import {
  FlussUserInputError,
  UserInputOperation,
  UserInputErrorCode,
} from "../utils/validation/FlussUserInputError";

@InputType()
class UpdateProfileInput {
  @Field()
  planetOfOrigin?: number;
}

@Resolver(Profile)
export class ProfileResolver {
  @Mutation(() => Profile, { nullable: true })
  @UseMiddleware(isLogged)
  async updateProfile(
    @Ctx() { req }: MyContext,
    @Arg("newProfile") profileInput: UpdateProfileInput
  ): Promise<Profile | null> {
    // Find the logged user
    const user = await User.findOne({
      where: { id: req.session.userId },
      relations: ["profile"],
    });

    if (!user) {
      throw new FlussUserInputError("Invalid user.", {
        operation: UserInputOperation.changePassword,
        flussError: UserInputErrorCode.InvalidUser,
      });
    }

    // Check if user owns the profile
    // ? Is this necessary
    const relatedProfile = await Profile.findOne({
      where: { id: user.profile.id },
    });

    if (!relatedProfile) {
      throw new FlussUserInputError("Invalid user.", {
        operation: UserInputOperation.changePassword,
        flussError: UserInputErrorCode.InvalidUser,
      });
    }

    let planetOfOrigin: undefined | Planet = undefined;
    if (profileInput.planetOfOrigin) {
      // Find the planet coming from front end
      planetOfOrigin = await Planet.findOne(profileInput.planetOfOrigin); // pass an id number
      if (planetOfOrigin) {
        // add the planet to the profile
        // relatedProfile.planetOfOrigin = planetOfOrigin;
        // await Profile.save(relatedProfile);

        // this code sets category of a given post
        await getConnection()
          .createQueryBuilder()
          .relation(Profile, "planetOfOrigin")
          .of(relatedProfile) // you can use just post id as well
          .set(planetOfOrigin); // you can use just category id as well
      }
    }
    return relatedProfile;
  }

  @Query(() => Profile)
  @UseMiddleware(isLogged)
  async profile(@Ctx() { req }: MyContext): Promise<Profile> {
    const currentUser = await User.findOne({
      where: { id: req.session.userId },
      relations: ["profile", "profile.planetOfOrigin", "profile.user"],
    });
    if (!currentUser) {
      throw new FlussUserInputError("Invalid user.", {
        operation: UserInputOperation.changePassword,
        flussError: UserInputErrorCode.InvalidUser,
      });
    }
    return currentUser.profile;
  }
}
