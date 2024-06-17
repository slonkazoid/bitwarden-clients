import { Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";

import { RequestSMAccessRequest } from "../models/Requests/request-sm-access.request";

@Injectable({
  providedIn: "root",
})
export class SmLandingApiService {
  constructor(private apiService: ApiService) {}

  async requestSMAccessFromAdmins(request: RequestSMAccessRequest): Promise<any> {
    return this.apiService.send("POST", "/request-access/request-sm-access", request, true, false);
  }
}
