import { type MessageParticipantRole } from 'twenty-shared/types';

export type PermaventWeeklyReportCompanyLink = {
  id: string;
  name: string;
};

export type PermaventWeeklyReportParticipant = {
  displayName: string | null;
  handle: string | null;
  role: MessageParticipantRole;
};

export type PermaventWeeklyReportMessage = {
  body: string | null;
  companies: PermaventWeeklyReportCompanyLink[];
  id: string;
  messageThreadId: string | null;
  participants: PermaventWeeklyReportParticipant[];
  receivedAt: string;
  subject: string;
};

export type PermaventWeeklyReportNote = {
  body: string | null;
  companies: PermaventWeeklyReportCompanyLink[];
  createdAt: string;
  id: string;
  title: string;
};

export type PermaventWeeklyReportUnlinkedReason =
  | 'NO_PERSON'
  | 'OUTSIDE_SCOPE_COMPANY'
  | 'PERSON_WITHOUT_COMPANY';

export type PermaventWeeklyReportUnlinkedMessage = Omit<
  PermaventWeeklyReportMessage,
  'companies'
> & {
  reason: PermaventWeeklyReportUnlinkedReason;
};

export type PermaventWeeklyReportUnlinkedNote = Omit<
  PermaventWeeklyReportNote,
  'companies'
> & {
  reason: 'NO_COMPANY' | 'OUTSIDE_SCOPE_COMPANY';
};

export type PermaventWeeklySalesReportSource = {
  actorWorkspaceMemberId: string;
  messages: PermaventWeeklyReportMessage[];
  notes: PermaventWeeklyReportNote[];
  period: {
    generatedAt: string;
    start: string;
    timeZone: 'Europe/London';
  };
  scope: {
    activeTerritoryCount: number;
    companyCount: number;
    peopleCount: number;
  };
  stats: {
    messageCount: number;
    multiCompanyMessageCount: number;
    multiCompanyNoteCount: number;
    noteCount: number;
    unlinkedMessageCount: number;
    unlinkedNoteCount: number;
  };
  unlinkedMessages: PermaventWeeklyReportUnlinkedMessage[];
  unlinkedNotes: PermaventWeeklyReportUnlinkedNote[];
};
