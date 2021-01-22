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
      return { vote: false };
    }

    // user has already voted but is changing the vote
    if (famePointVote && famePointVote.value !== realValue) {
      const updateFame = await Fame.update(
        { postId, userId },
        { value: realValue }
      );

      if (!updateFame) return { vote: false };

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
        return { vote: false };
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
  @Query(() => PaginatedPost) // todo: Review this, looks not so good being data.posts.posts...
  async posts(
    @Arg("limit", () => Int) limit: number,
    @Arg("cursor", () => String, { nullable: true }) cursor: string | null, // actually a date value like `1610814686802`
    @Ctx() { req }: MyContext
  ): Promise<PaginatedPost> {
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

    // const queryBuilder = getConnection()
    //   .getRepository(Post)
    //   .createQueryBuilder("p")
    //   .innerJoinAndSelect("p.owner", "user", 'user.id = p."ownerId"') // todo: read about join wtf
    //   .orderBy('p."createdAt"', "DESC")
    //   .take(realLimitPlusOne);

    // if (cursor) {
    //   queryBuilder.where('p."createdAt" < :cursor', {
    //     cursor: new Date(parseInt(cursor)),
    //   });
    // }
    // const posts = await queryBuilder.getMany();

    return {
      posts: posts.slice(0, realLimit),
      hasMore: posts.length === realLimitPlusOne,
    };
  }

  /**
   * @Post
   */
  @Query(() => Post, { nullable: true })
  post(@Arg("id") id: number): Promise<Post | undefined> {
    return Post.findOne({ id });
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
  async updatePost(
    @Arg("title", () => String, { nullable: true }) title: string,
    @Arg("id") id: number
  ): Promise<Post | undefined> {
    const post = await Post.findOne(id);

    if (!post) {
      return undefined;
    }

    if (typeof title !== "undefined") {
      Post.update({ id }, { title });
    }
    return post;
  }
  /**
   * @DeletePost
   */
  @Mutation(() => Boolean)
  async deletePost(@Arg("id") id: number): Promise<boolean> {
    try {
      Post.delete(id);
    } catch {
      return false;
    }
    return true;
  }
}
