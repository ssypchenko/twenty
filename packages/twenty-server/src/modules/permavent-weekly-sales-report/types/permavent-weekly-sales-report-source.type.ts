import { type MessageParticipantRole } from 'twenty-shared/types';

export type PermaventWeeklyReportEntityLink = {
  entityType: 'BRANCH' | 'COMPANY';
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
  entities: PermaventWeeklyReportEntityLink[];
  id: string;
  messageThreadId: string | null;
  participants: PermaventWeeklyReportParticipant[];
  receivedAt: string;
  subject: string;
};

export type PermaventWeeklyReportNote = {
  body: string | null;
  entities: PermaventWeeklyReportEntityLink[];
  createdAt: string;
  id: string;
  title: string;
};

export type PermaventWeeklyReportUnlinkedReason = 'PERSON_WITHOUT_ENTITY';

export type PermaventWeeklyReportUnlinkedMessage = Omit<
  PermaventWeeklyReportMessage,
  'companies'
> & {
  reason: PermaventWeeklyReportUnlinkedReason;
};

export type PermaventWeeklyReportUnlinkedNote = Omit<
  PermaventWeeklyReportNote,
  'entities'
> & {
  reason: 'NO_ENTITY';
};

export type PermaventWeeklySalesReportSource = {
  actorWorkspaceMemberId: string;
  messages: PermaventWeeklyReportMessage[];
  internalMessages: PermaventWeeklyReportMessage[];
  notes: PermaventWeeklyReportNote[];
  period: {
    generatedAt: string;
    start: string;
    timeZone: 'Europe/London';
  };
  scope: {
    activeTerritoryCount: number;
    entityCount: number;
  };
  stats: {
    internalMessageCount: number;
    messageCount: number;
    multiEntityMessageCount: number;
    multiEntityNoteCount: number;
    noteCount: number;
    unlinkedMessageCount: number;
    unlinkedNoteCount: number;
  };
  unlinkedMessages: PermaventWeeklyReportUnlinkedMessage[];
  unlinkedNotes: PermaventWeeklyReportUnlinkedNote[];
};
