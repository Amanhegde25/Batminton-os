import { describe, expect, it } from "vitest";
import { registerUser, authenticate, completeSetup } from "../src/server/services/users";

describe("Auth and Setup Flow", () => {
  const ts = Date.now();
  const emailUserEmail = `emailonly_${ts}@test.club`;
  const mobileUserPhone = `+919811${String(ts).slice(-6)}`;
  const password = "Password123!";

  it("registers successfully with email only", async () => {
    const user = await registerUser({
      name: "Email Only User",
      email: emailUserEmail,
      password
    });

    expect(user.id).toBeDefined();
    expect(user.email).toBe(emailUserEmail);
    expect(user.mobile).toBeNull();
    expect(user.aadhar).toBeNull();
    expect(user.hasCompletedSetup).toBe(false);

    // Can authenticate with email
    const authUser = await authenticate(emailUserEmail, password);
    expect(authUser.id).toBe(user.id);
  });

  it("registers successfully with mobile number only", async () => {
    const user = await registerUser({
      name: "Mobile Only User",
      mobile: mobileUserPhone,
      password
    });

    expect(user.id).toBeDefined();
    expect(user.email).toBeNull();
    expect(user.mobile).toBe(mobileUserPhone);
    expect(user.aadhar).toBeNull();
    expect(user.hasCompletedSetup).toBe(false);

    // Can authenticate with mobile using raw number or with country code
    const rawMobile = mobileUserPhone.replace("+91", "");
    const authUser = await authenticate(rawMobile, password);
    expect(authUser.id).toBe(user.id);

    const authUserFull = await authenticate(mobileUserPhone, password);
    expect(authUserFull.id).toBe(user.id);
  });

  it("fails registration if neither email nor mobile is provided", async () => {
    await expect(
      registerUser({
        name: "No Contact User",
        password
      })
    ).rejects.toThrow("Either email or mobile number must be provided");
  });

  it("completes setup by optionally adding email and 12-digit Aadhaar", async () => {
    const mobileOnly = await registerUser({
      name: "Setup Test User",
      mobile: `+919822${String(Date.now()).slice(-6)}`,
      password
    });

    // 1. Rejects invalid Aadhaar length
    await expect(
      completeSetup(mobileOnly.id, {
        aadhar: "12345"
      })
    ).rejects.toThrow("Aadhaar number must be exactly 12 digits");

    // 2. Successfully adds email and valid 12-digit Aadhaar
    const validAadhar = `8${String(Date.now()).slice(-11)}`;
    const formattedAadhar = `${validAadhar.slice(0, 4)} ${validAadhar.slice(4, 8)} ${validAadhar.slice(8, 12)}`;
    const linkedEmail = `linked_${Date.now()}@test.club`;
    const updated = await completeSetup(mobileOnly.id, {
      email: linkedEmail,
      aadhar: formattedAadhar
    });

    expect(updated.email).toBe(linkedEmail);
    expect(updated.aadhar).toBe(validAadhar);
    expect(updated.hasCompletedSetup).toBe(true);

    // 3. Rejects duplicate Aadhaar from another user
    const anotherUser = await registerUser({
      name: "Another User",
      email: `another_${Date.now()}@test.club`,
      password
    });

    await expect(
      completeSetup(anotherUser.id, {
        aadhar: validAadhar
      })
    ).rejects.toThrow("This Aadhaar number is already linked to another account");
  });

  it("updates email, mobile, and Aadhaar via profile settings", async () => {
    const user = await registerUser({
      name: "Settings User",
      mobile: `+9197${String(Date.now()).slice(-8)}`,
      password
    });

    const newEmail = `settings_${Date.now()}@test.club`;
    const newAadhar = `7${String(Date.now()).slice(-11)}`;
    const { updateProfile } = await import("../src/server/services/users");

    const updated = await updateProfile(user.id, {
      name: "Settings User Updated",
      email: newEmail,
      aadhar: newAadhar
    });

    expect(updated.name).toBe("Settings User Updated");
    expect(updated.email).toBe(newEmail);
    expect(updated.aadhar).toBe(newAadhar);
  });

  it("allows removing phone number if email is linked, and vice versa", async () => {
    const { updateProfile } = await import("../src/server/services/users");
    const user = await registerUser({
      name: "Dual Contact User",
      email: `dual_${Date.now()}@test.club`,
      mobile: `+9196${String(Date.now()).slice(-8)}`,
      password
    });

    // 1. Remove mobile number (email is still linked)
    const withoutMobile = await updateProfile(user.id, {
      mobile: ""
    });
    expect(withoutMobile.mobile).toBeNull();
    expect(withoutMobile.email).toBeTruthy();

    // 2. Add mobile number back and remove email
    const newMobile = `+9195${String(Date.now()).slice(-8)}`;
    const withoutEmail = await updateProfile(user.id, {
      email: "",
      mobile: newMobile
    });
    expect(withoutEmail.email).toBeNull();
    expect(withoutEmail.mobile).toBe(newMobile);

    // 3. Attempting to remove mobile when email is already null fails
    await expect(
      updateProfile(user.id, {
        mobile: ""
      })
    ).rejects.toThrow("You must have at least an email address or mobile number linked to your account");
  });

  it("does not require Aadhaar in settings and allows clearing it", async () => {
    const { updateProfile } = await import("../src/server/services/users");
    const aadharNum = `6${String(Date.now()).slice(-11)}`;
    const user = await registerUser({
      name: "Aadhaar Test User",
      email: `aadhar_${Date.now()}@test.club`,
      password
    });

    // 1. Update profile without providing Aadhaar (should not fail or require Aadhaar)
    const updatedWithoutAadhaar = await updateProfile(user.id, {
      name: "Updated Name Only"
    });
    expect(updatedWithoutAadhaar.name).toBe("Updated Name Only");
    expect(updatedWithoutAadhaar.aadhar).toBeNull();

    // 2. Set an Aadhaar number
    const withAadhaar = await updateProfile(user.id, {
      aadhar: aadharNum
    });
    expect(withAadhaar.aadhar).toBe(aadharNum);

    // 3. Clear the Aadhaar number
    const clearedAadhaar = await updateProfile(user.id, {
      aadhar: ""
    });
    expect(clearedAadhaar.aadhar).toBeNull();
  });

  it("allows skipping setup", async () => {
    const userToSkip = await registerUser({
      name: "Skip User",
      email: `skip_${Date.now()}@test.club`,
      password
    });

    expect(userToSkip.hasCompletedSetup).toBe(false);

    const skipped = await completeSetup(userToSkip.id, { skip: true });
    expect(skipped.hasCompletedSetup).toBe(true);
    expect(skipped.aadhar).toBeNull();
  });
});
