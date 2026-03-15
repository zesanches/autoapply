import { JobPlatform } from "../value-objects/JobPlatform.js";

export interface JobListingProps {
  id: string;
  externalId: string;
  platform: JobPlatform;
  title: string;
  company: string;
  location: string | null;
  salary: string | null;
  description: string | null;
  url: string;
  postedAt: Date | null;
  scrapedAt: Date;
  metadata: unknown | null;
  isActive: boolean;
}

export class JobListing {
  private constructor(private readonly props: JobListingProps) {}

  static create(props: JobListingProps): JobListing {
    return new JobListing(props);
  }

  get id(): string {
    return this.props.id;
  }

  get externalId(): string {
    return this.props.externalId;
  }

  get platform(): JobPlatform {
    return this.props.platform;
  }

  get title(): string {
    return this.props.title;
  }

  get company(): string {
    return this.props.company;
  }

  get url(): string {
    return this.props.url;
  }

  get location(): string | null {
    return this.props.location ?? null;
  }

  get salary(): string | null {
    return this.props.salary ?? null;
  }

  get postedAt(): Date | null {
    return this.props.postedAt ?? null;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  platformKey(): string {
    return `${this.props.platform.value}:${this.props.externalId}`;
  }
}
