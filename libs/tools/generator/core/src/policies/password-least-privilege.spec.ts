import { PolicyType } from "@bitwarden/common/admin-console/enums";
// FIXME: use index.ts imports once policy abstractions and models
// implement ADR-0002
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { PolicyId } from "@bitwarden/common/types/guid";

import { DisabledPasswordGeneratorPolicy } from "../data";

import { passwordLeastPrivilege } from "./password-least-privilege";

function createPolicy(
  data: any,
  type: PolicyType = PolicyType.PasswordGenerator,
  enabled: boolean = true,
) {
  return new Policy({
    id: "id" as PolicyId,
    organizationId: "organizationId",
    data,
    enabled,
    type,
  });
}

describe("passwordLeastPrivilege", () => {
  it("should return the accumulator when the policy type does not apply", () => {
    const policy = createPolicy({}, PolicyType.RequireSso);

    const result = passwordLeastPrivilege(DisabledPasswordGeneratorPolicy, policy);

    expect(result).toEqual(DisabledPasswordGeneratorPolicy);
  });

  it("should return the accumulator when the policy is not enabled", () => {
    const policy = createPolicy({}, PolicyType.PasswordGenerator, false);

    const result = passwordLeastPrivilege(DisabledPasswordGeneratorPolicy, policy);

    expect(result).toEqual(DisabledPasswordGeneratorPolicy);
  });

  it.each([
    ["minLength", 10, "minLength"],
    ["useUpper", true, "useUppercase"],
    ["useLower", true, "useLowercase"],
    ["useNumbers", true, "useNumbers"],
    ["minNumbers", 10, "numberCount"],
    ["useSpecial", true, "useSpecial"],
    ["minSpecial", 10, "specialCount"],
  ])("should take the %p from the policy", (input, value, expected) => {
    const policy = createPolicy({ [input]: value });

    const result = passwordLeastPrivilege(DisabledPasswordGeneratorPolicy, policy);

    expect(result).toEqual({ ...DisabledPasswordGeneratorPolicy, [expected]: value });
  });
});
