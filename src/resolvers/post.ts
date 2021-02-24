import isLogged from "../middlewear/isLogged";
import { MyContext } from "src/types";
import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
  UseMiddleware,
} from "type-graphql";
import { Post } from "../entities/Post";
import { getConnection } from "typeorm";
import { Fame } from "../entities/Fame";
import {
  FlussUserInputError,
  UserInputOperation,
  UserInputErrorCode,
} from "../utils/validation/FlussUserInputError";
import { FlussError } from "../utils/validation/FlussError";

@InputType()
class PostInput {
  @Field()
  title: string;
  @Field()
  text: string;
}

@ObjectType()
class PaginatedPost {
  @Field(() => [Post])
  posts: Post[];
  @Field()
  hasMore: boolean;
}

@ObjectType()
class VoteResponse {
  @Field(() => Boolean)
  vote: boolean;

  @Field(() => Int, { nullable: true })
  currentCount?: number;
}

@Resolver(Post)
export class PostResolver {
  @Mutation(() => VoteResponse)
  @UseMiddleware(isLogged)
  async vote(
    @Arg("postId", () => Int) postId: number,
    @Arg("value", () => Int) value: number,
    @Ctx() { req }: MyContext
  ): Promise<VoteResponse> {
    const isPositiveFame = value !== -1;
    const realValue = isPositiveFame ? 1 : -1;
    const { userId } = req.session;

    const famePointVote = await Fame.findOne({ where: { postId, userId } });

    const postToUpdate = await Post.findOne({ id: postId });
    if (!postToUpdate) {
      throw new FlussError("Something went wrong. Refresh and try again.");
    }

    // user has already voted but is changing the vote
    if (famePointVote && famePointVote.value !== realValue) {
      const updateFame = await Fame.update(
        { postId, userId },
        { value: realValue }
      );

      if (!updateFame) {
        throw new FlussError("Something went wrong. Refresh and try again.");
      }

      postToUpdate.famePoints = postToUpdate.famePoints + 2 * realValue;
      famePointVote.value = realValue;
    } else if (!famePointVote) {
      // There is no vote yet, so the user has not voted on this post
      // so normal logic to vote
      const insertFame = await Fame.insert({
        userId,
        postId,
        value: realValue,
      });

      if (!insertFame) {
        throw new FlussError("Something went wrong. Refresh and try again.");
      }

      postToUpdate.famePoints = postToUpdate.famePoints + realValue;
    }

    await Post.save(postToUpdate);
    return {
      vote: true,
      currentCount: postToUpdate.famePoints,
    };
  }

  @FieldResolver(() => String)
  textSnippet(@Root() root: Post) {
    return root.text.slice(0, 80);
  }
  /**
   * @Posts
   *
   * @param limit - How many posts returned per query
   * @param {timestamp} cursor
   *
   * @returns all Posts before the date `cursor` represents
   */
  @Query(() => PaginatedPost)
  async posts(
    @Arg("limit", () => Int) limit: number,
    @Arg("cursor", () => String, { nullable: true }) cursor: string | null, // actually a date value like `1610814686802`
    @Ctx() { req }: MyContext
  ): Promise<PaginatedPost> {
    // TODO: REFACTOR THE WHOLE SELECT QUERY LOGIC
    const realLimit = Math.min(50, limit) + 1;
    const realLimitPlusOne = realLimit + 1;

    const replacements: any[] = [realLimitPlusOne];

    if (req.session.userId) replacements.push(req.session.userId);
    let cursorIndex = 3;
    if (cursor) {
      replacements.push(new Date(parseInt(cursor)));
      cursorIndex = replacements.length;
    }
    const posts = await getConnection().query(
      `
        select p.*, 
        json_build_object(
          'id', u.id,
          'username', u.username,
          'email', u.email,
          'createdAt', u."createdAt",
          'updatedAt', u."updatedAt"
          ) as owner,
        ${
          req.session.userId
            ? `(select value from fame where "userId" = $2 and "postId" = p.id) "voteStatus"`
            : `null as "voteStatus"`
        }
        from post p
        inner join public.user u on u.id = p."ownerId"
        ${cursor ? `where p."createdAt" < $${cursorIndex}` : ""}
        order by p."createdAt" DESC
        limit $1
    `,
      replacements
    );

    return {
      posts: posts.slice(0, realLimit),
      hasMore: posts.length === realLimitPlusOne,
    };
  }

  /**
   * @Post
   */
  @Query(() => Post, { nullable: true })
  post(@Arg("id", () => Int) id: number): Promise<Post | undefined> {
    return Post.findOne({ id }, { relations: ["owner"] });
  }

  /**
   * @CreatePost
   */
  @Mutation(() => Post)
  @UseMiddleware(isLogged)
  async createPost(
    @Arg("input") input: PostInput,
    @Ctx() { req }: MyContext
  ): Promise<Post | null> {
    return Post.create({
      ...input,
      ownerId: req.session.userId,
    }).save();
  }

  /**
   * @UpdatePost
   */
  @Mutation(() => Post, { nullable: true })
  @UseMiddleware(isLogged)
  async updatePost(
    @Arg("title", () => String, { nullable: true }) title: string,
    @Arg("text", () => String, { nullable: true }) text: string,
    @Arg("id", () => Int) id: number,
    @Ctx() { req }: MyContext
  ): Promise<Post | undefined> {
    const result = await getConnection()
      .createQueryBuilder()
      .update(Post)
      .set({ title, text })
      .returning("*")
      .where('id = :id and "ownerId" = :ownerId', {
        id,
        ownerId: req.session.userId,
      })
      .execute();

    return result.raw[0];
  }

  /**
   * @DeletePost
   */
  @Mutation(() => Boolean)
  @UseMiddleware(isLogged)
  async deletePost(
    @Arg("id", () => Int) id: number,
    @Ctx() { req }: MyContext
  ): Promise<boolean> {
    const post = await Post.findOne(id);
    if (!post) {
      throw new FlussError("Something went wrong. Refresh and try again.");
    }

    if (post.ownerId !== req.session.userId) {
      throw new FlussUserInputError("Invalid user.", {
        operation: UserInputOperation.changePassword,
        flussError: UserInputErrorCode.InvalidUser,
      });
    }

    await Fame.delete({ postId: id });
    await Post.delete({ id });
    return true;
  }
}
