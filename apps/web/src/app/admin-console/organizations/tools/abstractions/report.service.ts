import { MemberAccessReportView } from "../models/view/member-access-report.view";

export abstract class ReportService {
  abstract getMemberAccessMockData(): MemberAccessReportView[];
}
