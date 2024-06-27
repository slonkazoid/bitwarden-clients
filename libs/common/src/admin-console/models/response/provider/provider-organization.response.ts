import { BaseResponse } from "../../../../models/response/base.response";

export class ProviderOrganizationResponse extends BaseResponse {
  id: string;
  providerId: string;
  organizationId: string;
  key: string;
  settings: string;
  creationDate: string;
  revisionDate: string;
  userCount: number;
  seats?: number;
  assignedSeats?: number;
  remainingSeats?: number;
  plan?: string;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.providerId = this.getResponseProperty("ProviderId");
    this.organizationId = this.getResponseProperty("OrganizationId");
    this.key = this.getResponseProperty("Key");
    this.settings = this.getResponseProperty("Settings");
    this.creationDate = this.getResponseProperty("CreationDate");
    this.revisionDate = this.getResponseProperty("RevisionDate");
    this.userCount = this.getResponseProperty("UserCount");
    this.seats = this.getResponseProperty("Seats");
    this.assignedSeats = this.getResponseProperty("AssignedSeats");
    this.remainingSeats = this.getResponseProperty("RemainingSeats");
    this.plan = this.getResponseProperty("Plan");
  }
}

export class ProviderOrganizationOrganizationDetailsResponse extends ProviderOrganizationResponse {
  organizationName: string;

  constructor(response: any) {
    super(response);
    this.organizationName = this.getResponseProperty("OrganizationName");
  }
}
