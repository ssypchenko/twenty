export const normalisePermaventAssignmentEmail = (email: string): string => {
  const normalisedEmail = email.trim().toLowerCase();

  if (normalisedEmail.length === 0) {
    throw new Error('An assignment email must not be empty.');
  }

  return normalisedEmail;
};
