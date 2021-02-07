import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BaseEntity,
  OneToMany,
  OneToOne,
  JoinColumn,
} from "typeorm";
import { ObjectType, Field } from "type-graphql";
import { Post } from "./Post";
import { Fame } from "./Fame";
import { Profile } from "./Profile";

@ObjectType()
@Entity()
export class User extends BaseEntity {
  @Field()
  @PrimaryGeneratedColumn()
  id!: number;

  @Field()
  @Column({ unique: true })
  email!: string;

  @Field()
  @Column({ unique: true })
  username!: string;

  @Column()
  password!: string;

  @OneToMany(() => Post, (post) => post.owner)
  posts: Post[];

  @OneToMany(() => Fame, (fame) => fame.user)
  fame: Fame[];

  @Field()
  @OneToOne(() => Profile, (profile) => profile.user)
  @JoinColumn()
  profile: Profile;

  // -------
  @Field(() => String)
  @CreateDateColumn()
  createdAt = Date();

  @Field(() => String)
  @UpdateDateColumn()
  updatedAt = Date();
}
