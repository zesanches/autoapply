export interface UserProfileProps {
  id: string;
  userId: string;
  fullName: string;
  phone: string | null;
  location: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  resumeUrl: string | null;
  resumeData: unknown | null;
  skills: string[];
  experience: unknown | null;
  education: unknown | null;
  preferences: unknown | null;
  isComplete: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class UserProfile {
  private constructor(private readonly props: UserProfileProps) {}

  static create(props: UserProfileProps): UserProfile {
    return new UserProfile(props);
  }

  get id(): string {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get fullName(): string {
    return this.props.fullName;
  }

  get isComplete(): boolean {
    return this.props.isComplete;
  }

  get skills(): string[] {
    return [...this.props.skills];
  }

  checkCompleteness(): boolean {
    return (
      this.props.fullName.trim().length > 0 &&
      this.props.skills.length > 0 &&
      this.props.resumeData !== null
    );
  }

  toJSON(): UserProfileProps {
    return { ...this.props };
  }
}
